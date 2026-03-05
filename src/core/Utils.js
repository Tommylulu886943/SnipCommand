export const isTextValid = text => text && text.length > 0 && text.replace(/ /g, '').length > 0;

export const escapeHtml = str => {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
};