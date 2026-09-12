/**
 * Testes para mimeTypes.ts
 */

import { getMimeType } from '../mimeTypes';

describe('getMimeType', () => {
  it('retorna tipo MIME correto para imagens', () => {
    expect(getMimeType('photo.jpg')).toBe('image/jpeg');
    expect(getMimeType('photo.jpeg')).toBe('image/jpeg');
    expect(getMimeType('image.png')).toBe('image/png');
    expect(getMimeType('image.gif')).toBe('image/gif');
    expect(getMimeType('image.webp')).toBe('image/webp');
  });

  it('retorna tipo MIME correto para vídeos', () => {
    expect(getMimeType('video.mp4')).toBe('video/mp4');
    expect(getMimeType('movie.mov')).toBe('video/quicktime');
    expect(getMimeType('video.webm')).toBe('video/webm');
  });

  it('retorna tipo MIME correto para áudio', () => {
    expect(getMimeType('song.mp3')).toBe('audio/mpeg');
    expect(getMimeType('audio.wav')).toBe('audio/wav');
    expect(getMimeType('music.m4a')).toBe('audio/mp4');
  });

  it('retorna tipo MIME correto para documentos', () => {
    expect(getMimeType('document.pdf')).toBe('application/pdf');
    expect(getMimeType('document.docx')).toBe(
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    );
    expect(getMimeType('spreadsheet.xlsx')).toBe(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    expect(getMimeType('file.txt')).toBe('text/plain');
    expect(getMimeType('data.json')).toBe('application/json');
  });

  it('retorna application/octet-stream para extensões desconhecidas', () => {
    expect(getMimeType('unknown.xyz')).toBe('application/octet-stream');
    expect(getMimeType('file.abc')).toBe('application/octet-stream');
  });

  it('retorna application/octet-stream para arquivo sem extensão', () => {
    expect(getMimeType('README')).toBe('application/octet-stream');
    expect(getMimeType('Makefile')).toBe('application/octet-stream');
  });

  it('retorna application/octet-stream para input inválido', () => {
    expect(getMimeType('')).toBe('application/octet-stream');
    expect(getMimeType(null as unknown as string)).toBe('application/octet-stream');
    expect(getMimeType(undefined as unknown as string)).toBe('application/octet-stream');
  });

  it('é case-insensitive para extensões', () => {
    expect(getMimeType('photo.JPG')).toBe('image/jpeg');
    expect(getMimeType('Photo.Jpg')).toBe('image/jpeg');
    expect(getMimeType('DOCUMENT.PDF')).toBe('application/pdf');
  });

  it('retorna compressão MIME types', () => {
    expect(getMimeType('archive.zip')).toBe('application/zip');
    expect(getMimeType('archive.7z')).toBe('application/x-7z-compressed');
    expect(getMimeType('file.gz')).toBe('application/gzip');
  });
});
