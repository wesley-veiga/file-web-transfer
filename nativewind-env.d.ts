/// <reference types="nativewind/types" />

declare module '*.css' {
  const content: Record<string, unknown>;
  export default content;
}
