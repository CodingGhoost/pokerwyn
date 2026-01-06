module.exports = {
  testEnvironment: "node",
  verbose: true,
  transformIgnorePatterns: [
    "node_modules/(?!(poker-odds-calculator)/)"
  ],
  
  transform: {
    "^.+\\.[t|j]sx?$": "babel-jest"
  },
  extensionsToTreatAsEsm: [],
};
