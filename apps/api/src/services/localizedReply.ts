import type { ForecastRecord, SupportedLocale, WasteRiskRecord } from '@verdeai/shared-types';

type Copy = {
  empty: string;
  item: (name: string, predicted: string, average: string, high: boolean) => string;
  unknown: (question: string, items: string) => string;
  steady: (count: string) => string;
  detail: (name: string, predicted: string, above: string | null) => string;
  summary: (count: string, total: string, details: string) => string;
};
const copy: Record<Exclude<SupportedLocale, 'en'>, Copy> = {
  kn: {
    empty: 'ಈ ರೆಸ್ಟೋರೆಂಟ್ ಮತ್ತು ದಿನಾಂಕಕ್ಕೆ ಇನ್ನೂ ಮುನ್ಸೂಚನೆ ದತ್ತಾಂಶ ಲಭ್ಯವಿಲ್ಲ.',
    item: (name, predicted, average, high) => `${name}: ಮುನ್ಸೂಚಿತ ಪ್ರಮಾಣ ${predicted}, ಹಿಂದಿನ ಸರಾಸರಿ ${average}. ಆಹಾರ ವ್ಯರ್ಥದ ಅಪಾಯ ${high ? 'ಹೆಚ್ಚು. ಹೆಚ್ಚುವರಿ ಆಹಾರ ಉಳಿಯದಂತೆ ತಯಾರಿಯ ಪ್ರಮಾಣವನ್ನು ಸುಮಾರು 15–20% ಕಡಿಮೆ ಮಾಡುವುದನ್ನು ಪರಿಗಣಿಸಿ.' : 'ಕಡಿಮೆ. ಈಗಿನ ತಯಾರಿಯ ಪ್ರಮಾಣ ಸೂಕ್ತವಾಗಿದೆ.'}`,
    unknown: (question, items) => `ಇಂದಿನ ಮುನ್ಸೂಚನೆಯಲ್ಲಿ “${question}” ಎಂಬ ಪದಾರ್ಥ ಕಂಡುಬಂದಿಲ್ಲ. ಲಭ್ಯವಿರುವ ಪದಾರ್ಥಗಳು: ${items}.`,
    steady: (count) => `ಇಂದು ಪರಿಶೀಲಿಸಿದ ${count} ಪದಾರ್ಥಗಳ ಬೇಡಿಕೆ ಸ್ಥಿರವಾಗಿದೆ. ಯಾವುದೇ ಪದಾರ್ಥಕ್ಕೆ ಹೆಚ್ಚಿನ ಅಪಾಯವಿಲ್ಲ. ತಯಾರಿಯ ಪ್ರಮಾಣ ಬದಲಾಯಿಸುವ ಅಗತ್ಯವಿಲ್ಲ.`,
    detail: (name, predicted, above) => `${name} (ಮುನ್ಸೂಚನೆ ${predicted}${above !== null ? `, ಸರಾಸರಿಗಿಂತ ಸುಮಾರು ${above}% ಹೆಚ್ಚು` : ''})`,
    summary: (count, total, details) => `ಇಂದು ಒಟ್ಟು ${total} ಪದಾರ್ಥಗಳಲ್ಲಿ ${count} ಪದಾರ್ಥಗಳನ್ನು ಅಗತ್ಯಕ್ಕಿಂತ ಹೆಚ್ಚು ತಯಾರಿಸುವ ಅಪಾಯವಿದೆ: ${details}. ಇವುಗಳ ತಯಾರಿಯ ಪ್ರಮಾಣವನ್ನು ಸುಮಾರು 15% ಕಡಿಮೆ ಮಾಡಿ ಮತ್ತು ಹೆಚ್ಚುವರಿ ಆಹಾರ ವ್ಯರ್ಥವಾಗದಂತೆ ಮಧ್ಯಾಹ್ನ ಮಾರಾಟವನ್ನು ಪರಿಶೀಲಿಸಿ.`,
  },
  hi: {
    empty: 'इस रेस्तराँ और तारीख के लिए अभी पूर्वानुमान डेटा उपलब्ध नहीं है।',
    item: (name, predicted, average, high) => `${name}: अनुमानित मात्रा ${predicted} है, जबकि पिछला औसत ${average} है। भोजन बर्बादी का जोखिम ${high ? 'अधिक है। अतिरिक्त भोजन बचने से रोकने के लिए तैयारी लगभग 15–20% कम करने पर विचार करें।' : 'कम है। वर्तमान तैयारी उचित लगती है।'}`,
    unknown: (question, items) => `आज के पूर्वानुमान में “${question}” नाम का व्यंजन नहीं मिला। उपलब्ध व्यंजन हैं: ${items}।`,
    steady: (count) => `आज सभी ${count} व्यंजनों की माँग स्थिर है। किसी में अधिक जोखिम नहीं है। तैयारी में बदलाव की सलाह नहीं है।`,
    detail: (name, predicted, above) => `${name} (पूर्वानुमान ${predicted}${above !== null ? `, औसत से लगभग ${above}% अधिक` : ''})`,
    summary: (count, total, details) => `आज कुल ${total} में से ${count} व्यंजनों में ज़रूरत से अधिक तैयारी का जोखिम है: ${details}। इनकी तैयारी लगभग 15% कम करें और अतिरिक्त भोजन की बर्बादी रोकने के लिए दोपहर में बिक्री जाँचें।`,
  },
  fr: {
    empty: 'Aucune prévision disponible pour ce restaurant à cette date.',
    item: (name, predicted, average, high) => `${name} : prévision de ${predicted} unités contre une moyenne historique de ${average}. Le risque de gaspillage est ${high ? 'élevé. Envisagez de réduire la préparation d’environ 15–20 % pour éviter les surplus.' : 'faible. Les quantités préparées semblent adaptées.'}`,
    unknown: (question, items) => `Je ne trouve pas « ${question} » dans les prévisions du jour. Les plats suivis sont : ${items}.`,
    steady: (count) => `La demande est stable pour les ${count} plats suivis aujourd’hui. Aucun risque élevé n’est signalé. Aucun changement de préparation recommandé.`,
    detail: (name, predicted, above) => `${name} (prévision ${predicted}${above !== null ? `, environ ${above} % au-dessus de la moyenne` : ''})`,
    summary: (count, total, details) => `Aujourd’hui, ${count} plats sur ${total} présentent un risque de surproduction : ${details}. Réduisez leur préparation d’environ 15 % et vérifiez les ventes à midi pour éviter de jeter les surplus.`,
  },
  es: {
    empty: 'Todavía no hay previsiones para este restaurante y esta fecha.',
    item: (name, predicted, average, high) => `${name}: previsión de ${predicted} unidades frente a un promedio histórico de ${average}. El riesgo de desperdicio es ${high ? 'alto. Considera reducir la preparación aproximadamente un 15–20 % para evitar excedentes.' : 'bajo. Las cantidades preparadas parecen adecuadas.'}`,
    unknown: (question, items) => `No encuentro «${question}» en las previsiones de hoy. Los platos registrados son: ${items}.`,
    steady: (count) => `La demanda es estable para los ${count} platos registrados hoy. Ninguno presenta un riesgo alto. No se recomiendan cambios en la preparación.`,
    detail: (name, predicted, above) => `${name} (previsión ${predicted}${above !== null ? `, aproximadamente un ${above} % por encima del promedio` : ''})`,
    summary: (count, total, details) => `Hoy, ${count} de ${total} platos presentan riesgo de sobreproducción: ${details}. Reduce su preparación aproximadamente un 15 % y revisa las ventas al mediodía para evitar desechar excedentes.`,
  },
};

/** Menu names are source data and stay consistent with the restaurant's menu. */
export function localizedReply(
  forecasts: ForecastRecord[], wasteRisk: WasteRiskRecord[], question: string | undefined,
  locale: Exclude<SupportedLocale, 'en'>,
): string {
  const text = copy[locale];
  const number = (value: number) => new Intl.NumberFormat(locale).format(value);
  if (!forecasts.length) return text.empty;
  if (question) {
    const match = forecasts.find((f) => question.toLocaleLowerCase(locale).includes(f.item.toLocaleLowerCase(locale)));
    if (match) return text.item(match.item, number(match.predictedQuantity), number(Math.round(match.historicalAverage)), wasteRisk.some((w) => w.item === match.item && w.riskScore === 'HIGH'));
    return text.unknown(question, forecasts.map((f) => f.item).join(', '));
  }
  const highRisk = wasteRisk.filter((w) => w.riskScore === 'HIGH');
  if (!highRisk.length) return text.steady(number(forecasts.length));
  const details = highRisk.map((w) => {
    const forecast = forecasts.find((f) => f.item === w.item);
    const above = forecast && forecast.historicalAverage > 0
      ? number(Math.round((forecast.predictedQuantity - forecast.historicalAverage) / forecast.historicalAverage * 100)) : null;
    return text.detail(w.item, number(w.predictedQuantity), above);
  }).join(', ');
  return text.summary(number(highRisk.length), number(forecasts.length), details);
}
