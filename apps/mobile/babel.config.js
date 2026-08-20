// É o `babel-preset-expo` que injecta o EXPO_ROUTER_APP_ROOT que o expo-router
// lê no `_ctx`. Sem este ficheiro o bundle falha logo com "Invalid call ...
// process.env.EXPO_ROUTER_APP_ROOT".
module.exports = function (api) {
  api.cache(true);
  return { presets: ['babel-preset-expo'] };
};
