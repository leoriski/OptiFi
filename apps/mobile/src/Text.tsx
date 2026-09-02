import { forwardRef } from 'react';
import {
  StyleSheet,
  Text as RNText,
  TextInput as RNTextInput,
  type TextInput as RNTextInputType,
  type TextInputProps,
  type TextProps,
  type TextStyle,
} from 'react-native';

/**
 * A Manrope, em todo o lado.
 *
 * Na web isto era uma linha — `body{font-family:'Manrope',sans-serif}` — e
 * cascateava para tudo. O React Native não tem cascata nem herança de fonte
 * entre componentes, e pior: com fontes estáticas (uma por peso) o
 * `fontWeight: '800'` não escolhe o ficheiro certo, escolhe o que o sistema
 * inventar a partir do Regular. Cada peso tem de nomear a sua família.
 *
 * Por isso o `Text` da app é este: lê o `fontWeight` do estilo, troca-o pela
 * família correspondente, e é ele que os ecrãs importam em vez do
 * `react-native`. Assim o estilo continua a escrever-se como na web
 * (`fontWeight: '900'`) e a fonte sai certa.
 */
const FAMILY: Record<string, string> = {
  '100': 'Manrope_200ExtraLight',
  '200': 'Manrope_200ExtraLight',
  '300': 'Manrope_300Light',
  '400': 'Manrope_400Regular',
  '500': 'Manrope_500Medium',
  '600': 'Manrope_600SemiBold',
  '700': 'Manrope_700Bold',
  // A Manrope acaba no ExtraBold: o 900 do protótipo desenha-se com o 800.
  '800': 'Manrope_800ExtraBold',
  '900': 'Manrope_800ExtraBold',
  normal: 'Manrope_400Regular',
  bold: 'Manrope_700Bold',
};

/** Substitui `fontWeight` pela família da Manrope com esse peso. */
function withFont<T extends TextStyle>(style: T | T[] | undefined): TextStyle {
  const flat = (StyleSheet.flatten(style) ?? {}) as TextStyle;
  // Um `fontFamily` escrito à mão manda — é a forma de fugir a isto de
  // propósito (por exemplo, um número tabular).
  if (flat.fontFamily) return flat;
  const weight = flat.fontWeight === undefined ? '400' : String(flat.fontWeight);
  const { fontWeight: _drop, ...rest } = flat;
  return { ...rest, fontFamily: FAMILY[weight] ?? FAMILY['400']! };
}

export const Text = forwardRef<RNText, TextProps>(function Text({ style, ...rest }, ref) {
  return <RNText ref={ref} {...rest} style={withFont(style as TextStyle)} />;
});

export const TextInput = forwardRef<RNTextInputType, TextInputProps>(function TextInput({ style, ...rest }, ref) {
  return <RNTextInput ref={ref} {...rest} style={withFont(style as TextStyle)} />;
});

/** Os pesos que a app usa — é isto que o `useFonts` carrega no arranque. */
export { Manrope_400Regular, Manrope_500Medium, Manrope_600SemiBold, Manrope_700Bold, Manrope_800ExtraBold } from '@expo-google-fonts/manrope';
