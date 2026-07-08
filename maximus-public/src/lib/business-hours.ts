import type { PublicBusinessHour, WeekdayKey } from "./geo";

const DAY_LABELS: Record<WeekdayKey, string> = {
  segunda: "Segunda",
  terca: "Terça",
  quarta: "Quarta",
  quinta: "Quinta",
  sexta: "Sexta",
  sabado: "Sábado",
  domingo: "Domingo",
};

export function formatBusinessHour(hour: PublicBusinessHour) {
  if (!hour.open) return `${DAY_LABELS[hour.day]}: fechado`;
  const periods = hour.periods
    .filter((period) => period.opensAt && period.closesAt)
    .map((period) => `${period.opensAt} às ${period.closesAt}`)
    .join(", ");
  return `${DAY_LABELS[hour.day]}: ${periods || "horário não informado"}`;
}

export function formatBusinessHours(hours?: PublicBusinessHour[]) {
  return hours?.length ? hours.map(formatBusinessHour) : ["Horários não cadastrados"];
}
