// Shrina Proxy for Vercel - Simple JavaScript Version
// No dependencies needed!

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Range, Authorization',
  'Access-Control-Expose-Headers': 'Content-Length, Content-Range',
};

const DOMAIN_HEADERS = {
  'kwikie.ru': { origin: 'https://kwik.si', referer: 'https://kwik.si/' },
  'padorupado.ru': { origin: 'https://kwik.si', referer: 'https://kwik.si/' },
  'krussdomi.com': { origin: 'https://hls.krussdomi.com', referer: 'https://hls.krussdomi.com/' },
  'megacloud.blog': { origin: 'https://megacloud.blog', referer: 'https://megacloud.blog/' },
  'megacloud.club': { origin: 'https://megacloud.club', referer: 'https://megacloud.club/' },
  'vmeas.cloud': { origin: 'https://vidmoly.to', referer: 'https://vidmoly.to/' },
  'embed.su': { origin: 'https://embed.su', referer: 'https://embed.su/' },
  'akamaized.net': { origin: 'https://bl.krussdomi.com', referer: 'https://bl.krussdomi.com/' },
  'premilkyway.com': { origin: 'https://uqloads.xyz', referer: 'https://uqloads.xyz/' },
  'anih1.top': { origin: 'https://ee.anih1.top', referer: 'https://ee.anih1.top/' },
  'xyk3.top': { origin: 'https://ee.anih1.top', referer: 'https://ee.anih1.top/' },
};

function getDomainHeaders(hostname) {
  for (const [domain, headers] of Object.entries(DOMAIN_HEADERS)) {
    if (hostname.includes(domain)) return headers;
  }
  return {};
}

function processM3U8(content, baseUrl, targetUrl) {
  const lines = content.split(/\r?\n/);
  const base = targetUrl.substring(0, targetUrl.lastIndexOf('/') + 1);
  
  return lines.map(line => {
    const trim = line.trim();
    
    if (line.includes('URI="')) {
      return line.replace(/URI="([^"]+)"/g, (match, uri) => {
        let abs;
        try {
          abs = uri.startsWith('http') ? uri : new URL(uri, base).href;
        } catch {
          abs = uri;
        }
        return `URI="${baseUrl}?url=${encodeURIComponent(abs)}"`;
      });
    }
    
    if (trim && !trim.startsWith('#') && !trim.startsWith(baseUrl)) {
      let abs;
      try {
        if (trim.startsWith('http')) {
          abs = trim;
        } else if (trim.startsWith('//')) {
          abs = 'https:' + trim;
        } else {
          abs = new URL(trim, base).href;
        }
        return `${baseUrl}?url=${encodeURIComponent(abs)}`;
      } catch {
        return line;
      }
    }
    
    return line;
  }).join('\n');
}

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));
    return res.status(204).end();
  }
  
  const targetUrl = req.query.url;
  
  if (!targetUrl) {
    res.setHeader('Content-Type', 'application/json');
    Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));
    return res.status(400).json({
      error: 'Missing url parameter',
      usage: 'Add ?url=https://example.com/video.m3u8',
      example: `https://${req.headers.host}/api/proxy?url=https://example.com/video.m3u8`
    });
  }
  
  try {
    const url = new URL(targetUrl);
    
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': '*/*',
      'Accept-Language': 'en-US,en;q=0.9',
      ...getDomainHeaders(url.hostname)
    };
    
    if (req.headers.range) {
      headers['Range'] = req.headers.range;
    }
    
    const response = await fetch(targetUrl, {
      method: req.method,
      headers,
      signal: AbortSignal.timeout(25000)
    });
    
    const isM3U8 = targetUrl.endsWith('.m3u8') || 
                   response.headers.get('content-type')?.includes('mpegurl');
    
    if (isM3U8) {
      const text = await response.text();
      const baseUrl = `https://${req.headers.host}/api/proxy`;
      const processed = processM3U8(text, baseUrl, targetUrl);
      
      res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
      Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));
      res.setHeader('Cache-Control', 'public, max-age=300');
      return res.status(200).send(processed);
    }
    
    Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));
    
    const contentType = response.headers.get('content-type');
    const contentLength = response.headers.get('content-length');
    const contentRange = response.headers.get('content-range');
    const acceptRanges = response.headers.get('accept-ranges');
    
    if (contentType) res.setHeader('Content-Type', contentType);
    if (contentLength) res.setHeader('Content-Length', contentLength);
    if (contentRange) res.setHeader('Content-Range', contentRange);
    if (acceptRanges) res.setHeader('Accept-Ranges', acceptRanges);
    
    const buffer = await response.arrayBuffer();
    return res.status(response.status).send(Buffer.from(buffer));
    
  } catch (error) {
    console.error('Proxy error:', error);
    
    res.setHeader('Content-Type', 'application/json');
    Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));
    
    return res.status(500).json({
      error: 'Proxy request failed',
      message: error.message,
      target: targetUrl
    });
  }
};
