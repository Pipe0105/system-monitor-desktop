import { useLanguage } from "../i18n/index.tsx";
import type { Language } from "../i18n/index.tsx";

const LanguageSelector = () => {
  const { language, setLanguage, t } = useLanguage();

  return (
    <label className="settings-field">
      <span>{t("settings.language.label")}</span>
      <select
        value={language}
        onChange={(event) => setLanguage(event.target.value as Language)}
      >
        <option value="es">{t("settings.language.options.es")}</option>
        <option value="en">{t("settings.language.options.en")}</option>
      </select>
    </label>
  );
};

export default LanguageSelector;
