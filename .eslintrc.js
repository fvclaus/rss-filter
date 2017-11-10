module.exports = {
  "extends": ["eslint:recommended", "semistandard"],
  "parserOptions": {
      "ecmaVersion": 5,
      "sourceType": "module"
  },
  "rules": {
      "semi": 2,
      "indent": 2,
      "no-cond-assign": "off"
  },
  "env": {
      "node": true
  }
};
