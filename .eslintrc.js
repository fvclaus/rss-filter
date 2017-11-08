module.exports = {
  "extends": ["eslint:recommended", "semistandard"],
  "parserOptions": {
      "ecmaVersion": 5,
      "sourceType": "module"
  },
  "rules": {
      "semi": 2,
      "no-console": "off",
      "indent": 2
  },
  "env": {
      "browser": true,
      "node": true
  }
};
