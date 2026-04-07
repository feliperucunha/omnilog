/** Locales supported by the web app and monthly digest emails. */
export type DigestLocale = "en" | "pt-BR" | "es";

export function normalizeDigestLocale(raw: string | null | undefined): DigestLocale {
  if (raw === "pt-BR" || raw === "es") return raw;
  return "en";
}

export function formatDigestMonthLabel(start: Date, locale: DigestLocale): string {
  const intlLocale = locale === "pt-BR" ? "pt-BR" : locale;
  return new Intl.DateTimeFormat(intlLocale, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(start);
}

type Copy = {
  subjectPrefix: string;
  monthlyRecapKicker: string;
  greeting: (name: string) => string;
  intro: string;
  newLogs: string;
  completed: string;
  reviewsSaved: string;
  contentHours: string;
  /** Individual play sessions (BoardGameMatch rows) in the period. */
  boardGameMatchesLogged: string;
  /** Completed logs with media type board games. */
  boardGamesCompleted: string;
  /** New logs with media type board games. */
  boardGamesAdded: string;
  purchaseTotal: string;
  openApp: string;
  footer: string;
  textYourRecap: (month: string) => string;
  textPurchaseLine: string;
  textReceiving: string;
};

const en: Copy = {
  subjectPrefix: "Your Geeklogs recap",
  monthlyRecapKicker: "Monthly recap",
  greeting: (name) => `Hi ${name},`,
  intro:
    "Here's what you tracked on Geeklogs during this period — including board game play sessions, matches played, ownership, sale flags, and mechanics where you use them.",
  newLogs: "New logs",
  completed: "Completed",
  reviewsSaved: "Reviews saved",
  contentHours: "Content hours",
  boardGameMatchesLogged: "Board game matches logged",
  boardGamesCompleted: "Board games completed",
  boardGamesAdded: "Board games added",
  purchaseTotal: "Purchase total",
  openApp: "Open Geeklogs",
  footer:
    "You're receiving this because you have a Geeklogs account. Stats use UTC calendar months and match in-app summaries where applicable.",
  textYourRecap: (month) => `Your Geeklogs recap for ${month}:`,
  textPurchaseLine: "Purchase total",
  textReceiving: "You're receiving this because you have a Geeklogs account.",
};

const ptBR: Copy = {
  subjectPrefix: "Seu resumo Geeklogs",
  monthlyRecapKicker: "Resumo mensal",
  greeting: (name) => `Olá, ${name},`,
  intro:
    "Aqui está o que você registrou no Geeklogs neste período — incluindo partidas de jogos de tabuleiro, partidas jogadas, posse, venda e mecânicas quando você usa esses campos.",
  newLogs: "Novos registros",
  completed: "Concluídos",
  reviewsSaved: "Resenhas salvas",
  contentHours: "Horas de conteúdo",
  boardGameMatchesLogged: "Partidas de jogos de tabuleiro registradas",
  boardGamesCompleted: "Jogos de tabuleiro concluídos",
  boardGamesAdded: "Jogos de tabuleiro adicionados",
  purchaseTotal: "Total em compras",
  openApp: "Abrir Geeklogs",
  footer:
    "Você recebeu este e-mail porque tem uma conta no Geeklogs. Os números usam meses civis em UTC e seguem as mesmas regras do app quando aplicável.",
  textYourRecap: (month) => `Seu resumo Geeklogs de ${month}:`,
  textPurchaseLine: "Total em compras",
  textReceiving: "Você recebeu este e-mail porque tem uma conta no Geeklogs.",
};

const es: Copy = {
  subjectPrefix: "Tu resumen de Geeklogs",
  monthlyRecapKicker: "Resumen mensual",
  greeting: (name) => `Hola, ${name},`,
  intro:
    "Esto es lo que registraste en Geeklogs en este periodo — incluidas partidas de juegos de mesa, partidas jugadas, propiedad, venta y mecánicas cuando las usas.",
  newLogs: "Registros nuevos",
  completed: "Completados",
  reviewsSaved: "Reseñas guardadas",
  contentHours: "Horas de contenido",
  boardGameMatchesLogged: "Partidas de juegos de mesa registradas",
  boardGamesCompleted: "Juegos de mesa completados",
  boardGamesAdded: "Juegos de mesa añadidos",
  purchaseTotal: "Total en compras",
  openApp: "Abrir Geeklogs",
  footer:
    "Recibes este correo porque tienes una cuenta en Geeklogs. Las estadísticas usan meses civiles en UTC y las mismas reglas que la app cuando aplica.",
  textYourRecap: (month) => `Tu resumen de Geeklogs para ${month}:`,
  textPurchaseLine: "Total en compras",
  textReceiving: "Recibes este correo porque tienes una cuenta en Geeklogs.",
};

export function digestCopy(locale: DigestLocale): Copy {
  if (locale === "pt-BR") return ptBR;
  if (locale === "es") return es;
  return en;
}
