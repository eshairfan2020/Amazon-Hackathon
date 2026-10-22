import PageHeader from '@/components/PageHeader';
import AssistantChat from '@/components/AssistantChat';

export default function AssistantPage() {
  return (
    <>
      <PageHeader title="AI Business Partner" subtitle="Ask about stock, reorders, margins and prices. I only use your own numbers." />
      <AssistantChat />
    </>
  );
}