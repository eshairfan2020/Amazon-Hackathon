module.exports = {
  content: ['./app/**/*.{js,jsx}', './components/**/*.{js,jsx}', './lib/**/*.js'],
  theme: { extend: { colors: {
    bg: '#131921', sidebar: '#232F3E', surface: '#1C2938', surfaceHover: '#28384B', line: '#344456',
    primary: '#FF9900', primaryHover: '#E88B00', onPrimary: '#192433', secondary: '#146EB4',
    ai: '#8B5CF6', highlight: '#F472B6', success: '#2DD4BF', warning: '#FBBF24', danger: '#FB7185',
    ink: '#F5F7FA', muted: '#AAB8C8' },
    keyframes: {
      botFloat: { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-5px)' } },
      botBlink: { '0%,92%,100%': { transform: 'scaleY(1)' }, '96%': { transform: 'scaleY(0.1)' } },
      botTalk: { '0%,100%': { transform: 'scaleY(0.35)' }, '50%': { transform: 'scaleY(1.1)' } },
      botPulse: { '0%,100%': { opacity: '0.35', transform: 'scale(1)' }, '50%': { opacity: '1', transform: 'scale(1.25)' } },
      botWiggle: { '0%,100%': { transform: 'rotate(-6deg)' }, '50%': { transform: 'rotate(6deg)' } },
      botWave: { '0%,100%': { transform: 'rotate(0deg)' }, '25%': { transform: 'rotate(-35deg)' }, '75%': { transform: 'rotate(-10deg)' } },
    },
    animation: {
      'bot-float': 'botFloat 3.2s ease-in-out infinite', 'bot-blink': 'botBlink 4.5s infinite', 'bot-talk': 'botTalk 0.28s ease-in-out infinite',
      'bot-pulse': 'botPulse 1s ease-in-out infinite', 'bot-wiggle': 'botWiggle 2.2s ease-in-out infinite', 'bot-wave': 'botWave 1.1s ease-in-out 2',
    } } },
  plugins: [],
};