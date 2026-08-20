const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// O Expo já trata das workspaces sozinho desde o SDK 52 — não é preciso
// watchFolders nem nodeModulesPaths aqui.
//
// O que ele NÃO resolve é o estilo de import dos @optifi/*: sendo ESM
// ("type": "module"), os ficheiros referem-se uns aos outros com a extensão
// final (`./state.js`) embora no disco só exista `./state.ts` — é o que a
// especificação de ESM manda escrever, e o TypeScript nunca reescreve o
// caminho. Na web isto resolve-se com `extensionAlias` no webpack; aqui é
// preciso dizer o mesmo ao Metro.
const defaultResolve = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName.startsWith('.') && moduleName.endsWith('.js')) {
    const asTs = moduleName.slice(0, -3);
    for (const ext of ['.ts', '.tsx']) {
      try {
        return context.resolveRequest(context, asTs + ext, platform);
      } catch {
        // Não era TypeScript — segue para a tentativa seguinte.
      }
    }
  }
  return (defaultResolve ?? context.resolveRequest)(context, moduleName, platform);
};

module.exports = config;
