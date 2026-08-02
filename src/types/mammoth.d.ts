declare module "mammoth" {
  interface ExtractResult {
    value: string;
    messages: Array<{ type: string; message: string }>;
  }
  interface MammothApi {
    extractRawText(input: { arrayBuffer: ArrayBuffer }): Promise<ExtractResult>;
  }
  const mammoth: MammothApi;
  export default mammoth;
}
