/**
 * Generates a random name by combining an adjective and a noun with a hyphen
 * @returns A string in the format "adjective-noun"
 */
export function randomName() {
  const adjectives: string[] = [
    'agile', 'atomic', 'awesome', 'blazing', 'bold', 'brave', 'bright', 'brilliant', 'busy',
    'clever', 'cosmic', 'crisp', 'curious', 'dapper', 'dazzling', 'dynamic', 'eager', 'elegant',
    'epic', 'fancy', 'fast', 'fluent', 'flying', 'friendly', 'fuzzy', 'gentle', 'glowing',
    'happy', 'harmonic', 'hidden', 'hyper', 'iconic', 'infinite', 'jolly', 'keen', 'logical',
    'magical', 'mighty', 'mini', 'modern', 'nimble', 'noble', 'novel', 'optimal', 'parallel',
    'peaceful', 'perfect', 'prime', 'quantum', 'quick', 'quiet', 'rapid', 'reactive', 'resilient',
    'robust', 'rustic', 'sacred', 'secure', 'sharp', 'shiny', 'silent', 'sleek', 'smooth',
    'solid', 'speedy', 'stellar', 'super', 'swift', 'tidy', 'tiny', 'turbo', 'vibrant',
    'vigilant', 'virtual', 'vivid', 'wild', 'wise', 'witty', 'wonderful', 'zealous'
  ];

  const nouns: string[] = [
    'algorithm', 'api', 'app', 'array', 'atom', 'badge', 'bash', 'bit', 'block', 'bot', 'byte',
    'cache', 'cat', 'chip', 'cli', 'cloud', 'code', 'commit', 'compiler', 'component', 'cookie',
    'core', 'crab', 'dashboard', 'data', 'db', 'dev', 'docker', 'docs', 'dom', 'dragon', 'edge',
    'element', 'falcon', 'feature', 'ferret', 'file', 'flow', 'flux', 'fox', 'framework', 'function',
    'gator', 'gem', 'git', 'graph', 'grid', 'hawk', 'heap', 'hook', 'hub', 'image', 'index',
    'iterator', 'jam', 'java', 'json', 'key', 'lab', 'lambda', 'leaf', 'lib', 'link', 'lint',
    'lion', 'list', 'logic', 'loop', 'lynx', 'map', 'matrix', 'mesh', 'method', 'micro', 'module',
    'monkey', 'net', 'node', 'object', 'octo', 'otter', 'package', 'panda', 'parser', 'path',
    'pattern', 'phoenix', 'pixel', 'plugin', 'pod', 'pointer', 'pony', 'portal', 'proxy', 'puma',
    'python', 'query', 'queue', 'rabbit', 'raccoon', 'react', 'repo', 'request', 'response',
    'router', 'ruby', 'script', 'server', 'service', 'shell', 'sloth', 'snake', 'socket', 'spark',
    'spec', 'sql', 'stack', 'state', 'static', 'stream', 'string', 'struct', 'style', 'syntax',
    'system', 'table', 'tag', 'task', 'template', 'tiger', 'token', 'tool', 'tree', 'type',
    'ui', 'util', 'vector', 'view', 'vm', 'web', 'widget', 'wolf', 'worker', 'yaml', 'zebra'
  ];

  // Get random index for adjective and noun
  const randomAdjectiveIndex = Math.floor(Math.random() * adjectives.length);
  const randomNounIndex = Math.floor(Math.random() * nouns.length);

  // Combine the randomly selected adjective and noun with a hyphen
  return `${adjectives[randomAdjectiveIndex]}-${nouns[randomNounIndex]}`;
}
