import { TradeOrder } from "../types";

const OFFLINE_TEMPLATES = [
  "Gratulacje dla firmy {client}! Wasze zamówienie u wystawcy {exhibitor} przyniosło Wam szczęście!",
  "Mamy zwycięzcę! {client} wygrywa nagrodę dzięki współpracy z {exhibitor}!",
  "Fantastyczna wiadomość dla {client}! Bilet od {exhibitor} okazał się tym szczęśliwym!",
  "Wielkie brawa dla {client}! Dziękujemy za zaufanie okazane firmie {exhibitor}!",
  "To jest Wasz dzień! {client} wygrywa losowanie! Podziękowania dla stoiska {exhibitor}.",
  "Ależ emocje! Zwycięża {client}. Udana transakcja z {exhibitor} procentuje!",
  "Szczęście uśmiechnęło się do firmy {client}! Gratulujemy świetnego wyboru dostawcy: {exhibitor}!",
  "Brawa! {client} zgarnia nagrodę. Dziękujemy za zamówienie złożone u {exhibitor}.",
  "Zwycięstwo! {client} - ten dzień należy do Was! Partnerstwo z {exhibitor} to strzał w dziesiątkę.",
  "Mamy to! {client} wygrywa nagrodę główną. Gratulacje dla wystawcy {exhibitor} za skuteczność!",
  "Niesamowite szczęście firmy {client}! Zamówienie u {exhibitor} okazało się przepustką do nagrody.",
  "Halo Targi! Zwycięża {client}! Dziękujemy wystawcy {exhibitor} za udział w sukcesie.",
  "Co za niespodzianka! Firma {client} dołącza do grona zwycięzców dzięki {exhibitor}!",
  "Los uśmiechnął się do {client}. Dziękujemy za wizytę na stoisku {exhibitor}!",
  "Mamy werdykt! Nagroda wędruje do {client}. Brawo dla wystawcy {exhibitor}!",
  "Targowy sukces! {client} wygrywa w wielkim stylu. Transakcja z {exhibitor} się opłaciła.",
  "Idealny wybór! {client} postawił na {exhibitor} i wygrał nagrodę!",
  "To musi być dobry dzień dla {client}! Gratulujemy wygranej i współpracy z {exhibitor}.",
  "Znakomity strzał! {client} wygrywa. Pozdrawiamy ekipę ze stoiska {exhibitor}.",
  "Wielka wygrana dla {client}! Dziękujemy, że jesteście z nami i z firmą {exhibitor}.",
];

const getLocalMessage = (winner: TradeOrder): string => {
  const template = OFFLINE_TEMPLATES[Math.floor(Math.random() * OFFLINE_TEMPLATES.length)];
  return template
    .replace("{client}", winner.clientName)
    .replace("{exhibitor}", winner.createdBy || "Dostawca");
};

// FIX #3: Podłączamy prawdziwe Gemini API. Klucz pobieramy z import.meta.env,
// nigdy nie wpisujemy go na stałe w kodzie. Jeśli klucz nie jest skonfigurowany,
// gracefully fallback do lokalnych szablonów.
export const generateCongratulationMessage = async (winner: TradeOrder): Promise<string> => {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;

  if (!apiKey) {
    // Brak klucza → lokalne szablony (tryb offline/demo)
    await new Promise((resolve) => setTimeout(resolve, 300));
    return getLocalMessage(winner);
  }

  try {
    const prompt = `Jesteś mistrzem ceremonii na targach branżowych HASta. 
Właśnie wylosowano zwycięzcę loterii. Napisz jedno, oryginalne i entuzjastyczne zdanie gratulacyjne po polsku (max 30 słów).
Zwycięzca: firma "${winner.clientName}", zamówienie złożone u wystawcy "${winner.createdBy || "Dostawca"}".
Odpowiedz tylko treścią gratulacji, bez cudzysłowów i żadnych wstępów.`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 100, temperature: 1.1 },
        }),
      }
    );

    if (!response.ok) throw new Error(`Gemini API error: ${response.status}`);

    const data = await response.json();
    const text: string | undefined =
      data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (text && text.trim().length > 0) return text.trim();
    throw new Error("Empty response from Gemini");
  } catch (err) {
    console.warn("Gemini API niedostępne, używam szablonu lokalnego:", err);
    return getLocalMessage(winner);
  }
};
