const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

const logger = {
  info: (message) => {
    console.log(`${colors.cyan}[INFO]${colors.reset} ${message}`);
  },
  success: (message) => {
    console.log(`${colors.green}[✓]${colors.reset} ${message}`);
  },
  warn: (message) => {
    console.warn(`${colors.yellow}[⚠]${colors.reset} ${message}`);
  },
  error: (message, error = null) => {
    console.error(`${colors.red}[✗]${colors.reset} ${message}`);
    if (error) console.error(error);
  },
  debug: (message) => {
    if (process.env.DEBUG === 'true') {
      console.log(`${colors.blue}[DEBUG]${colors.reset} ${message}`);
    }
  },
};

module.exports = logger;
