import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

interface ShareFileOptions {
  dialogTitle?: string;
  UTI?: string;
  mimeType?: string;
}

export const writeTextToCacheFile = async (fileName: string, content: string): Promise<string> => {
  const directory = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
  if (!directory) {
    throw new Error('No writable file directory available.');
  }

  const fileUri = `${directory}${fileName}`;
  await FileSystem.writeAsStringAsync(fileUri, content, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  return fileUri;
};

export const shareFile = async (uri: string, options: ShareFileOptions = {}): Promise<void> => {
  const available = await Sharing.isAvailableAsync();
  if (!available) {
    throw new Error('Sharing is not available on this device.');
  }

  await Sharing.shareAsync(uri, options);
};
