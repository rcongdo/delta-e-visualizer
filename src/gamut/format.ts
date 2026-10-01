export const formatDeviceValues = (channelNames: string[], values: number[]) =>
  channelNames.map((name, index) => `${name} ${Math.round(values[index] ?? 0)}`).join("  ");
