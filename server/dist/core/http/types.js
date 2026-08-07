"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.noContent = exports.created = exports.ok = void 0;
/** Yardımcı yanıt kurucuları — durum kodları tek yerden. */
const ok = (body) => ({ status: 200, body });
exports.ok = ok;
const created = (body) => ({ status: 201, body });
exports.created = created;
const noContent = () => ({ status: 204 });
exports.noContent = noContent;
//# sourceMappingURL=types.js.map