// Pure text transforms — no network, no state. Inputs are clipped before they reach these so a huge
// paste can't blow up an embed (Zalgo especially: it grows fast with intensity * length).

const NATO: Record<string, string> = {
  A: "Alfa", B: "Bravo", C: "Charlie", D: "Delta", E: "Echo", F: "Foxtrot", G: "Golf", H: "Hotel",
  I: "India", J: "Juliett", K: "Kilo", L: "Lima", M: "Mike", N: "November", O: "Oscar", P: "Papa",
  Q: "Quebec", R: "Romeo", S: "Sierra", T: "Tango", U: "Uniform", V: "Victor", W: "Whiskey",
  X: "Xray", Y: "Yankee", Z: "Zulu",
};

export function toNato(text: string): string {
  return text
    .toUpperCase()
    .split("")
    .map((c) => (NATO[c] ? NATO[c] : /[0-9]/.test(c) ? c : c === " " ? "/" : null))
    .filter((c): c is string => c !== null)
    .join(" ");
}

export function reverseText(text: string): string {
  return [...text].reverse().join("");
}

const ZALGO_UP = ["\u030d", "\u030e", "\u0304", "\u0305", "\u033f", "\u0311", "\u0306", "\u0310", "\u0352", "\u0357", "\u0351", "\u0307", "\u0308", "\u030a", "\u0342", "\u0343", "\u0344", "\u034a", "\u034b", "\u034c", "\u0303", "\u0302", "\u030c", "\u0350", "\u0300", "\u0301", "\u030b", "\u030f", "\u0312", "\u0313", "\u0314", "\u033d", "\u0309", "\u0363", "\u0364", "\u0365", "\u0366", "\u0367", "\u0368", "\u0369", "\u036a", "\u036b", "\u036c", "\u036d", "\u036e", "\u036f", "\u033e", "\u035b", "\u0346", "\u031a"];
const ZALGO_MID = ["\u0315", "\u031b", "\u0340", "\u0341", "\u0358", "\u0321", "\u0322", "\u0327", "\u0328", "\u0334", "\u0335", "\u0336", "\u034f", "\u035c", "\u035d", "\u035e", "\u035f", "\u0360", "\u0362", "\u0338", "\u0337", "\u0361"];
const ZALGO_DOWN = ["\u0316", "\u0317", "\u0318", "\u0319", "\u031c", "\u031d", "\u031e", "\u031f", "\u0320", "\u0324", "\u0325", "\u0326", "\u0329", "\u032a", "\u032b", "\u032c", "\u032d", "\u032e", "\u032f", "\u0330", "\u0331", "\u0332", "\u0333", "\u0339", "\u033a", "\u033b", "\u033c", "\u0345", "\u0347", "\u0348", "\u0349", "\u034d", "\u034e", "\u0323"];

const pick = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];

/** intensity 1-8, clamped. Higher = more marks per letter. */
export function toZalgo(text: string, intensity = 4): string {
  const n = Math.max(1, Math.min(8, Math.round(intensity)));
  return [...text]
    .map((c) => {
      if (c === " " || c === "\n") return c;
      let out = c;
      for (let i = 0; i < n; i++) out += pick(ZALGO_UP);
      for (let i = 0; i < Math.min(3, n); i++) out += pick(ZALGO_MID);
      for (let i = 0; i < n; i++) out += pick(ZALGO_DOWN);
      return out;
    })
    .join("");
}
