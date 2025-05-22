declare module 'samlify/build/src/utility' {
  /**
   * Sign an XML document
   */
  export function signXml(
    xml: string,
    options: {
      privateKey: string | Buffer | string[];
      signatureAlgorithm?: string;
      specificOptions?: {
        prefix?: string;
        location?: {
          reference: string;
          action: string;
        };
      };
    }
  ): string;

  export default {
    signXml
  };
} 