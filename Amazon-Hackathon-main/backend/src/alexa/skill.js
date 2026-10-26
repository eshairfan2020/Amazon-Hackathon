import { voicePending } from '../domain/schemas.js';

const WELCOME = 'Welcome to Anchor Inventory. You can say: add 20 body lotions, how many yoga mats do I have, or what is running low.';
const text = (s) => ({ type: 'PlainText', text: s });

export function parseLinks(list = []) {
  return new Map(list.map((s) => { const i = s.indexOf(':'); return i > 0 ? [s.slice(0, i).trim(), s.slice(i + 1).trim()] : null; }).filter(Boolean));
}

const envelope = (speech, { end = true, attrs = {}, reprompt, card, directives } = {}) => ({
  version: '1.0',
  sessionAttributes: attrs,
  response: {
    ...(speech ? { outputSpeech: text(speech) } : {}),
    ...(reprompt ? { reprompt: { outputSpeech: text(reprompt) } } : {}),
    ...(card ? { card } : {}),
    ...(directives ? { directives } : {}),
    shouldEndSession: end,
  },
});

/** Turns a verified Alexa request body into an Alexa response. `voice` is the shared voice service. */
export async function handleAlexaRequest(body, { voice, links }) {
  const req = body?.request ?? {};
  try {
    if (req.type === 'SessionEndedRequest') return { version: '1.0', response: {} };
    if (req.type === 'LaunchRequest') return envelope(WELCOME, { end: false, reprompt: 'What would you like to do?' });
    if (req.type !== 'IntentRequest') return envelope('Sorry, I cannot do that.');

    const name = req.intent?.name;
    if (['AMAZON.StopIntent', 'AMAZON.CancelIntent', 'AMAZON.NavigateHomeIntent'].includes(name)) return envelope('Goodbye.');
    if (['AMAZON.HelpIntent', 'AMAZON.FallbackIntent'].includes(name)) return envelope(`${WELCOME}`, { end: false, reprompt: 'What would you like to do?' });

    const alexaUserId = body.session?.user?.userId ?? body.context?.System?.user?.userId;
    const anchorUserId = alexaUserId ? links.get(alexaUserId) : null;
    if (!anchorUserId) {
      return envelope('I do not know your Anchor account yet. I put your link ID in the Alexa app. Add it to your Anchor settings, then try again.', {
        card: { type: 'Simple', title: 'Link Anchor Inventory', content: `Your Alexa link ID:\n${alexaUserId ?? 'unavailable'}\n\nAdd it to the backend ALEXA_LINKS setting as ${alexaUserId ?? 'ID'}:<your Anchor user ID>.` },
      });
    }

    const slot = (n) => req.intent?.slots?.[n]?.value;
    const parsed = voicePending.safeParse(body.session?.attributes?.pending);
    const pending = parsed.success ? parsed.data : null;
    let call;
    switch (name) {
      case 'AddItemIntent':
        if (req.dialogState && req.dialogState !== 'COMPLETED') return { version: '1.0', response: { directives: [{ type: 'Dialog.Delegate' }], shouldEndSession: false } };
        call = { intent: 'add', slots: { quantity: slot('quantity'), product: slot('product') } };
        break;
      case 'AMAZON.YesIntent': call = { intent: 'yes', pending }; break;
      case 'AMAZON.NoIntent': call = { intent: 'no', pending }; break;
      case 'StockLevelIntent': call = { intent: 'stock', slots: { product: slot('product') } }; break;
      case 'LowStockIntent': call = { intent: 'low' }; break;
      case 'ReorderIntent': call = { intent: 'reorder' }; break;
      default: return envelope(WELCOME, { end: false });
    }
    const r = await voice.run(anchorUserId, call);
    const reprompt = r.pending?.type === 'ask_quantity' ? 'How many?' : r.pending ? 'Should I go ahead? Say yes or no.' : undefined;
    return envelope(r.speech, { end: r.end, attrs: r.pending ? { pending: r.pending } : {}, reprompt });
  } catch {
    return envelope('Sorry, something went wrong. Please try again.');
  }
}