import { isBotUserAgent } from '../bot-user-agents';

const REAL_USER_AGENTS = [
  // Chrome 141 / Windows — the UA the 09-15 GlitchTip burst arrived under.
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
  // iPhone Safari
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1',
  // Android Chrome
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36',
  // Firefox desktop
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:130.0) Gecko/20100101 Firefox/130.0',
];

const BOT_USER_AGENTS: Array<[string, string]> = [
  ['Bytespider', 'Mozilla/5.0 (Linux; Android 5.0) AppleWebKit/537.36 (KHTML, like Gecko) Mobile Safari/537.36 (compatible; Bytespider; spider-feedback@bytedance.com)'],
  ['Googlebot', 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'],
  ['bingbot', 'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)'],
  ['AhrefsBot', 'Mozilla/5.0 (compatible; AhrefsBot/7.0; +http://ahrefs.com/robot/)'],
  ['SemrushBot', 'Mozilla/5.0 (compatible; SemrushBot/7~bl; +http://www.semrush.com/bot.html)'],
  ['PetalBot', 'Mozilla/5.0 (Linux; Android 7.0;) AppleWebKit/537.36 (KHTML, like Gecko) Mobile Safari/537.36 (compatible; PetalBot;+https://webmaster.petalsearch.com/site/petalbot)'],
  ['HeadlessChrome', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/120.0.0.0 Safari/537.36'],
  ['a generic unnamed bot', 'Mozilla/5.0 (compatible; SomeNewBot/1.0; +http://example.com)'],
  ['a generic crawler', 'Mozilla/5.0 (compatible; ExampleCrawler/3.2)'],
  ['a generic spider', 'Mozilla/5.0 (compatible; NightSpider)'],
];

describe('isBotUserAgent', () => {
  it.each(BOT_USER_AGENTS)('drops %s', (_name, userAgent) => {
    expect(isBotUserAgent(userAgent)).toBe(true);
  });

  it.each(REAL_USER_AGENTS)('keeps a real browser: %s', (userAgent) => {
    expect(isBotUserAgent(userAgent)).toBe(false);
  });

  it('is case insensitive', () => {
    expect(isBotUserAgent('mozilla/5.0 (compatible; googlebot/2.1)')).toBe(true);
    expect(isBotUserAgent('BYTESPIDER')).toBe(true);
  });

  it('treats a missing user agent as not-a-bot', () => {
    expect(isBotUserAgent(undefined)).toBe(false);
    expect(isBotUserAgent(null)).toBe(false);
    expect(isBotUserAgent('')).toBe(false);
  });

  it('does not match "bot" inside a device model string', () => {
    // CUBOT is a budget Android brand; its model strings must not read as bots.
    expect(
      isBotUserAgent(
        'Mozilla/5.0 (Linux; Android 10; CUBOT_X30) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'
      )
    ).toBe(false);
  });
});
