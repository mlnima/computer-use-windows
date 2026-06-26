import { getClipboardText, setClipboardText } from './clipboard';
import { createInputController } from '../input/controller';

export const pasteTextFast = async (text: string) => {
  const previous = await getClipboardText().catch(() => '');
  await setClipboardText(text);
  await createInputController().pressCombo(['Control', 'v']);
  await setClipboardText(previous);
};
