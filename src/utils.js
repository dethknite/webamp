import skins from "./skins.json";

export function screenshotUrlFromHash(hash) {
  return `https://s3.amazonaws.com/webamp-uploaded-skins/screenshots/${hash}.png`;
}

export function filenameFromHash(hash) {
  return skins[hash].fileName;
}

export function skinUrlFromHash(hash) {
  return `https://s3.amazonaws.com/webamp-uploaded-skins/skins/${hash}.wsz`;
}

export function getPermalinkUrlFromHash(hash) {
  return `/skin/${hash}/${filenameFromHash(hash)}/`;
}

export function getAbsolutePermalinkUrlFromHash(hash) {
  return window.location.origin + getPermalinkUrlFromHash(hash);
}

export function getWindowSize() {
  var w = window,
    d = document,
    e = d.documentElement,
    g = d.getElementsByTagName("body")[0],
    x = e.clientWidth || g.clientWidth || w.innerWidth,
    y = e.clientHeight || g.clientHeight || w.innerHeight;

  return {
    windowWidth: x,
    windowHeight: y
  };
}

export function eventIsLinkClick(event) {
  return (
    !event.defaultPrevented && // onClick prevented default
    event.button === 0 &&
    !(event.metaKey || event.altKey || event.ctrlKey || event.shiftKey)
  );
}

export function clamp(min, max, value) {
  return Math.min(max, Math.max(min, value));
}
