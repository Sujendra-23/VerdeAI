import type { LanguageCode, RiskLevel } from "@verdeai/shared-types";

/**
 * Localized wording for the deterministic fallback used when Azure OpenAI isn't
 * configured (or fails), so the multilingual chat also works fully offline.
 * Menu item names are never translated; they come from the data as-is.
 */
export interface ReplyCatalog {
  /** Separator between list entries. */
  sep: string;
  riskLabel: Record<RiskLevel, string>;
  noData: string;
  itemReply: (p: { item: string; predicted: number; average: number; risk: RiskLevel }) => string;
  notFound: (question: string, tracked: string[]) => string;
  steady: (count: number) => string;
  highRiskLine: (p: { item: string; predicted: number; overBy: number | null }) => string;
  highRiskSummary: (p: { high: number; total: number; lines: string }) => string;
  /** Words that mean "give me the overall picture" when no item is named. */
  summaryIntent: RegExp;
}

const en: ReplyCatalog = {
  sep: ", ",
  riskLabel: { HIGH: "HIGH", LOW: "LOW" },
  noData:
    "No forecast data is available for that restaurant and date yet — the nightly VerdeAI_GenerateForecast job hasn't produced a record for this combination.",
  itemReply: ({ item, predicted, average, risk }) =>
    `${item}: forecast is ${predicted} units vs a historical average of ${average}. Waste risk is ${risk}.${
      risk === "HIGH"
        ? " Consider trimming prep by roughly 15-20% to stay ahead of the surplus."
        : " Current prep levels look appropriate."
    }`,
  notFound: (q, tracked) =>
    `I don't see "${q}" by name in today's forecast. The tracked items are: ${tracked.join(", ")}.`,
  steady: (n) =>
    `Demand looks steady across all ${n} tracked items today — no items are flagged HIGH risk. No prep changes recommended.`,
  highRiskLine: ({ item, predicted, overBy }) =>
    `${item} (forecast ${predicted}${overBy !== null ? `, ~${overBy}% above average` : ""})`,
  highRiskSummary: ({ high, total, lines }) =>
    `${high} of ${total} items are trending toward overproduction today: ${lines}. Reduce prep volume on these by ~15% and monitor sell-through at midday to avoid discarding surplus.`,
  summaryIntent: /risk|waste|surplus|overprod|summary|overview|explain|prep\b/i,
};

const es: ReplyCatalog = {
  sep: ", ",
  riskLabel: { HIGH: "ALTO", LOW: "BAJO" },
  noData:
    "Todavía no hay datos de pronóstico para ese restaurante y fecha: el trabajo nocturno VerdeAI_GenerateForecast aún no ha generado un registro para esta combinación.",
  itemReply: ({ item, predicted, average, risk }) =>
    `${item}: el pronóstico es de ${predicted} unidades frente a un promedio histórico de ${average}. El riesgo de desperdicio es ${es.riskLabel[risk]}.${
      risk === "HIGH"
        ? " Considera reducir la preparación entre un 15 % y un 20 % para evitar el excedente."
        : " Los niveles actuales de preparación parecen adecuados."
    }`,
  notFound: (q, tracked) =>
    `No encuentro "${q}" por su nombre en el pronóstico de hoy. Los artículos que se siguen son: ${tracked.join(", ")}.`,
  steady: (n) =>
    `La demanda se ve estable en los ${n} artículos de hoy: ninguno tiene riesgo ALTO. No se recomiendan cambios en la preparación.`,
  highRiskLine: ({ item, predicted, overBy }) =>
    `${item} (pronóstico ${predicted}${overBy !== null ? `, ~${overBy} % por encima del promedio` : ""})`,
  highRiskSummary: ({ high, total, lines }) =>
    `${high} de ${total} artículos tienden a la sobreproducción hoy: ${lines}. Reduce la preparación de estos en ~15 % y revisa las ventas a mediodía para evitar desechar excedentes.`,
  summaryIntent: /riesgo|desperdicio|excedente|sobreproducci|resumen|explica|preparaci/i,
};

const fr: ReplyCatalog = {
  sep: ", ",
  riskLabel: { HIGH: "ÉLEVÉ", LOW: "FAIBLE" },
  noData:
    "Aucune donnée de prévision n'est encore disponible pour ce restaurant et cette date : la tâche nocturne VerdeAI_GenerateForecast n'a pas encore produit d'enregistrement pour cette combinaison.",
  itemReply: ({ item, predicted, average, risk }) =>
    `${item} : la prévision est de ${predicted} unités contre une moyenne historique de ${average}. Le risque de gaspillage est ${fr.riskLabel[risk]}.${
      risk === "HIGH"
        ? " Envisagez de réduire la préparation d'environ 15 à 20 % pour éviter le surplus."
        : " Les niveaux de préparation actuels semblent adaptés."
    }`,
  notFound: (q, tracked) =>
    `Je ne trouve pas « ${q} » par son nom dans les prévisions du jour. Les articles suivis sont : ${tracked.join(", ")}.`,
  steady: (n) =>
    `La demande semble stable pour les ${n} articles suivis aujourd'hui : aucun n'est signalé à risque ÉLEVÉ. Aucun changement de préparation recommandé.`,
  highRiskLine: ({ item, predicted, overBy }) =>
    `${item} (prévision ${predicted}${overBy !== null ? `, ~${overBy} % au-dessus de la moyenne` : ""})`,
  highRiskSummary: ({ high, total, lines }) =>
    `${high} articles sur ${total} tendent vers la surproduction aujourd'hui : ${lines}. Réduisez la préparation de ces articles d'environ 15 % et surveillez les ventes à midi pour éviter de jeter le surplus.`,
  summaryIntent: /risque|gaspill|surplus|surproduction|résumé|resume|explique|préparation/i,
};

const de: ReplyCatalog = {
  sep: ", ",
  riskLabel: { HIGH: "HOCH", LOW: "NIEDRIG" },
  noData:
    "Für dieses Restaurant und Datum liegen noch keine Prognosedaten vor – der nächtliche Job VerdeAI_GenerateForecast hat für diese Kombination noch keinen Datensatz erzeugt.",
  itemReply: ({ item, predicted, average, risk }) =>
    `${item}: Die Prognose liegt bei ${predicted} Einheiten, der historische Durchschnitt bei ${average}. Das Verschwendungsrisiko ist ${de.riskLabel[risk]}.${
      risk === "HIGH"
        ? " Erwägen Sie, die Vorbereitung um etwa 15–20 % zu reduzieren, um dem Überschuss zuvorzukommen."
        : " Die aktuelle Vorbereitungsmenge erscheint angemessen."
    }`,
  notFound: (q, tracked) =>
    `Ich finde „${q}“ heute nicht namentlich in der Prognose. Erfasste Artikel: ${tracked.join(", ")}.`,
  steady: (n) =>
    `Die Nachfrage wirkt bei allen ${n} erfassten Artikeln heute stabil – kein Artikel hat ein HOHES Risiko. Keine Änderungen an der Vorbereitung empfohlen.`,
  highRiskLine: ({ item, predicted, overBy }) =>
    `${item} (Prognose ${predicted}${overBy !== null ? `, ca. ${overBy} % über dem Durchschnitt` : ""})`,
  highRiskSummary: ({ high, total, lines }) =>
    `${high} von ${total} Artikeln tendieren heute zur Überproduktion: ${lines}. Reduzieren Sie die Vorbereitung dafür um ca. 15 % und prüfen Sie den Absatz mittags, um Überschuss zu vermeiden.`,
  summaryIntent: /risiko|verschwend|überschuss|überproduktion|zusammenfass|erklär|vorbereitung/i,
};

const pt: ReplyCatalog = {
  sep: ", ",
  riskLabel: { HIGH: "ALTO", LOW: "BAIXO" },
  noData:
    "Ainda não há dados de previsão para esse restaurante e data: o trabalho noturno VerdeAI_GenerateForecast ainda não gerou um registro para essa combinação.",
  itemReply: ({ item, predicted, average, risk }) =>
    `${item}: a previsão é de ${predicted} unidades, contra uma média histórica de ${average}. O risco de desperdício é ${pt.riskLabel[risk]}.${
      risk === "HIGH"
        ? " Considere reduzir o preparo em cerca de 15–20 % para evitar o excedente."
        : " Os níveis atuais de preparo parecem adequados."
    }`,
  notFound: (q, tracked) =>
    `Não encontro "${q}" pelo nome na previsão de hoje. Os itens acompanhados são: ${tracked.join(", ")}.`,
  steady: (n) =>
    `A demanda parece estável nos ${n} itens acompanhados hoje: nenhum está com risco ALTO. Nenhuma mudança de preparo recomendada.`,
  highRiskLine: ({ item, predicted, overBy }) =>
    `${item} (previsão ${predicted}${overBy !== null ? `, ~${overBy} % acima da média` : ""})`,
  highRiskSummary: ({ high, total, lines }) =>
    `${high} de ${total} itens tendem à superprodução hoje: ${lines}. Reduza o preparo desses itens em ~15 % e acompanhe as vendas ao meio-dia para evitar descartar excedentes.`,
  summaryIntent: /risco|desperd|excedente|superprodu|resumo|expliqu|preparo/i,
};

const it: ReplyCatalog = {
  sep: ", ",
  riskLabel: { HIGH: "ALTO", LOW: "BASSO" },
  noData:
    "Non ci sono ancora dati di previsione per quel ristorante e quella data: il job notturno VerdeAI_GenerateForecast non ha ancora prodotto un record per questa combinazione.",
  itemReply: ({ item, predicted, average, risk }) =>
    `${item}: la previsione è di ${predicted} unità rispetto a una media storica di ${average}. Il rischio di spreco è ${it.riskLabel[risk]}.${
      risk === "HIGH"
        ? " Valuta di ridurre la preparazione di circa il 15–20 % per evitare l'eccedenza."
        : " I livelli di preparazione attuali sembrano adeguati."
    }`,
  notFound: (q, tracked) =>
    `Non trovo "${q}" per nome nella previsione di oggi. Gli articoli monitorati sono: ${tracked.join(", ")}.`,
  steady: (n) =>
    `La domanda appare stabile su tutti i ${n} articoli monitorati oggi: nessuno è a rischio ALTO. Nessuna modifica alla preparazione consigliata.`,
  highRiskLine: ({ item, predicted, overBy }) =>
    `${item} (previsione ${predicted}${overBy !== null ? `, ~${overBy} % sopra la media` : ""})`,
  highRiskSummary: ({ high, total, lines }) =>
    `${high} articoli su ${total} tendono alla sovrapproduzione oggi: ${lines}. Riduci la preparazione di questi di circa il 15 % e controlla le vendite a metà giornata per evitare di buttare l'eccedenza.`,
  summaryIntent: /rischio|spreco|eccedenza|sovrapprod|riepilogo|spiega|preparazione/i,
};

const hi: ReplyCatalog = {
  sep: ", ",
  riskLabel: { HIGH: "उच्च", LOW: "कम" },
  noData:
    "उस रेस्तरां और तारीख के लिए अभी कोई पूर्वानुमान डेटा उपलब्ध नहीं है — रात का VerdeAI_GenerateForecast जॉब इस संयोजन के लिए अभी रिकॉर्ड नहीं बना पाया है।",
  itemReply: ({ item, predicted, average, risk }) =>
    `${item}: पूर्वानुमान ${predicted} यूनिट है, जबकि ऐतिहासिक औसत ${average} है। बर्बादी का जोखिम ${hi.riskLabel[risk]} है।${
      risk === "HIGH"
        ? " अतिरिक्त स्टॉक से बचने के लिए तैयारी लगभग 15-20% घटाने पर विचार करें।"
        : " तैयारी का मौजूदा स्तर उचित लगता है।"
    }`,
  notFound: (q, tracked) =>
    `आज के पूर्वानुमान में मुझे "${q}" नाम से नहीं मिला। ट्रैक किए जा रहे आइटम हैं: ${tracked.join(", ")}।`,
  steady: (n) =>
    `आज सभी ${n} ट्रैक किए गए आइटमों की मांग स्थिर दिख रही है — किसी भी आइटम का जोखिम उच्च नहीं है। तैयारी में किसी बदलाव की सलाह नहीं है।`,
  highRiskLine: ({ item, predicted, overBy }) =>
    `${item} (पूर्वानुमान ${predicted}${overBy !== null ? `, औसत से ~${overBy}% अधिक` : ""})`,
  highRiskSummary: ({ high, total, lines }) =>
    `आज ${total} में से ${high} आइटम ज़रूरत से ज़्यादा उत्पादन की ओर बढ़ रहे हैं: ${lines}। इनकी तैयारी लगभग 15% घटाएँ और बचे हुए माल को फेंकने से बचने के लिए दोपहर में बिक्री पर नज़र रखें।`,
  summaryIntent: /जोखिम|बर्बाद|सारांश|समझा|तैयारी|अतिरिक्त/,
};

const zh: ReplyCatalog = {
  sep: "、",
  riskLabel: { HIGH: "高", LOW: "低" },
  noData: "该餐厅和日期暂时没有预测数据——夜间任务 VerdeAI_GenerateForecast 尚未为此组合生成记录。",
  itemReply: ({ item, predicted, average, risk }) =>
    `${item}：预测量为 ${predicted} 份，历史平均为 ${average} 份。浪费风险：${zh.riskLabel[risk]}。${
      risk === "HIGH"
        ? "建议将备料量减少约 15%–20%，以避免出现过剩。"
        : "目前的备料水平看起来合适。"
    }`,
  notFound: (q, tracked) =>
    `在今天的预测中没有找到名为“${q}”的菜品。目前跟踪的菜品有：${tracked.join("、")}。`,
  steady: (n) =>
    `今天全部 ${n} 个跟踪菜品的需求看起来平稳，没有菜品被标记为高风险。建议无需调整备料。`,
  highRiskLine: ({ item, predicted, overBy }) =>
    `${item}（预测 ${predicted}${overBy !== null ? `，比平均值高约 ${overBy}%` : ""}）`,
  highRiskSummary: ({ high, total, lines }) =>
    `今天 ${total} 个菜品中有 ${high} 个有生产过剩的趋势：${lines}。建议将这些菜品的备料量减少约 15%，并在中午关注销售情况，避免浪费剩余食材。`,
  summaryIntent: /风险|浪费|过剩|总结|概述|解释|备料/,
};

const ja: ReplyCatalog = {
  sep: "、",
  riskLabel: { HIGH: "高", LOW: "低" },
  noData:
    "そのレストランと日付の予測データはまだありません。夜間ジョブ VerdeAI_GenerateForecast がこの組み合わせのレコードをまだ作成していません。",
  itemReply: ({ item, predicted, average, risk }) =>
    `${item}：予測は ${predicted} 個、過去平均は ${average} 個です。廃棄リスクは「${ja.riskLabel[risk]}」です。${
      risk === "HIGH"
        ? "余剰を避けるため、仕込み量を15〜20％ほど減らすことを検討してください。"
        : "現在の仕込み量は適切と思われます。"
    }`,
  notFound: (q, tracked) =>
    `本日の予測に「${q}」という名前の品目は見当たりません。追跡中の品目：${tracked.join("、")}。`,
  steady: (n) =>
    `本日は追跡中の全${n}品目で需要が安定しており、リスクが「高」の品目はありません。仕込みの変更は不要です。`,
  highRiskLine: ({ item, predicted, overBy }) =>
    `${item}（予測 ${predicted}${overBy !== null ? `、平均より約${overBy}％多い` : ""}）`,
  highRiskSummary: ({ high, total, lines }) =>
    `本日は${total}品目中${high}品目が過剰生産に傾いています：${lines}。これらの仕込み量を約15％減らし、余剰を出さないよう昼に売れ行きを確認してください。`,
  summaryIntent: /リスク|廃棄|余剰|要約|概要|説明|仕込み/,
};

export const CATALOGS: Record<LanguageCode, ReplyCatalog> = { en, es, fr, de, pt, it, hi, zh, ja };
