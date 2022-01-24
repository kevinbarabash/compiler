module.exports = {
  testPathIgnorePatterns: ["/node_modules/", "lib/"],
  transform: {
    "^.+\\.tsx?$": "esbuild-jest"
  },
};
