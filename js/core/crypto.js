// @security-critical
/**
 * BRAND ANALYTICS — crypto.js
 * AES-GCM 256bit 暗号化・復号モジュール
 *
 * ・セッションキーはメモリのみ保持（タブ終了時に破棄）
 * ・暗号化済みデータは Supabase に保存
 * ・Web Crypto API（ブラウザ標準）を使用
 */

(function () {
  'use strict';

  window.BA = window.BA || {};

  // ─────────────────────────────────────
  // プライベート変数（クロージャ内でのみアクセス可）
  // ─────────────────────────────────────
  let _sessionKey = null; // CryptoKey オブジェクト（メモリのみ）

  // ─────────────────────────────────────
  // 内部ユーティリティ
  // ─────────────────────────────────────

  /** ArrayBuffer → Base64文字列 */
  function _bufToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  /** Base64文字列 → ArrayBuffer */
  function _base64ToBuf(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }

  /** 文字列 → ArrayBuffer (UTF-8) */
  function _strToBuffer(str) {
    return new TextEncoder().encode(str);
  }

  /** ArrayBuffer → 文字列 (UTF-8) */
  function _bufferToStr(buffer) {
    return new TextDecoder().decode(buffer);
  }

  // ─────────────────────────────────────
  // 公開API
  // ─────────────────────────────────────

  const crypto = {

    /**
     * 初期化：セッションキーを新規生成（ページロード時に1度だけ呼ぶ）
     * キーはメモリにのみ存在。ページを閉じると消える。
     */
    async init() {
      try {
        _sessionKey = await window.crypto.subtle.generateKey(
          { name: 'AES-GCM', length: 256 },
          false,        // キーはエクスポート不可（メモリ内のみ）
          ['encrypt', 'decrypt']
        );
      } catch (err) {
        console.error('[crypto] init 失敗:', err);
        throw err;
      }
    },

    /**
     * 文字列を AES-GCM 256bit で暗号化する
     * @param {string} plainText - 暗号化する平文（トークン等）
     * @returns {Promise<string>} - "iv:ciphertext" 形式の Base64文字列
     */
    async encrypt(plainText) {
      if (!_sessionKey) throw new Error('[crypto] セッションキー未初期化');
      if (typeof plainText !== 'string') throw new TypeError('[crypto] encrypt: string が必要です');

      // 96bit（12byte）の IV をランダム生成（AES-GCM推奨値）
      const iv = window.crypto.getRandomValues(new Uint8Array(12));

      const encrypted = await window.crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        _sessionKey,
        _strToBuffer(plainText)
      );

      // IV と暗号文を ":" で連結して Base64 返却
      const ivB64 = _bufToBase64(iv.buffer);
      const ctB64 = _bufToBase64(encrypted);
      return `${ivB64}:${ctB64}`;
    },

    /**
     * encrypt() で生成した文字列を復号する
     * @param {string} encryptedStr - "iv:ciphertext" 形式の Base64文字列
     * @returns {Promise<string>} - 復号後の平文
     */
    async decrypt(encryptedStr) {
      if (!_sessionKey) throw new Error('[crypto] セッションキー未初期化');
      if (typeof encryptedStr !== 'string') throw new TypeError('[crypto] decrypt: string が必要です');

      const colonIdx = encryptedStr.indexOf(':');
      if (colonIdx === -1) throw new Error('[crypto] 不正な暗号化フォーマット');
      const ivB64 = encryptedStr.slice(0, colonIdx);
      const ctB64 = encryptedStr.slice(colonIdx + 1);
      if (!ivB64 || !ctB64) throw new Error('[crypto] 不正な暗号化フォーマット');

      const iv = new Uint8Array(_base64ToBuf(ivB64));
      const ciphertext = _base64ToBuf(ctB64);

      const decrypted = await window.crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        _sessionKey,
        ciphertext
      );

      return _bufferToStr(decrypted);
    },

    /**
     * セッションキーが初期化済みかどうかを確認する
     * @returns {boolean}
     */
    isReady() {
      return _sessionKey !== null;
    },

    /**
     * セッションキーを破棄する（明示的なログアウト時に呼ぶ）
     */
    destroy() {
      _sessionKey = null;
    },
  };

  // window.BA に登録
  window.BA.crypto = crypto;

})();
