<div align="center">
  <img src="./docs/screenshots/MainOmniRoute.png" alt="OmniRoute Dashboard" width="800"/>
  
  # 🚀 OmniRoute — Den kostnadsfria AI-gatewayen

### Sluta aldrig koda. Smart routing till **GRATIS & lågkostnads ​​AI-modeller** med automatisk reserv.

_Din universella API-proxy — en slutpunkt, 36+ leverantörer, noll driftstopp._

**Slutförda chatt • Inbäddningar • Bildgenerering • Ljud • Omrankning • 100 % TypeScript**

---

### 🤖 Gratis AI-leverantör för dina favoritkodningsagenter

_Anslut alla AI-drivna IDE- eller CLI-verktyg via OmniRoute — gratis API-gateway för obegränsad kodning._

  <table>
    <tr>
      <td align="center" width="110">
        <a href="https://github.com/cline/cline">
          <img src="./public/providers/openclaw.png" alt="OpenClaw" width="48"/><br/>
          <b>OpenClaw</b>
        </a><br/>
        <sub>⭐ 205K</sub>
      </td>
      <td align="center" width="110">
        <a href="https://github.com/HKUDS/nanobot">
          <img src="./public/providers/nanobot.png" alt="NanoBot" width="48"/><br/>
          <b>NanoBot</b>
        </a><br/>
        <sub>⭐ 20.9K</sub>
      </td>
      <td align="center" width="110">
        <a href="https://github.com/sipeed/picoclaw">
          <img src="./public/providers/picoclaw.jpg" alt="PicoClaw" width="48"/><br/>
          <b>PicoClaw</b>
        </a><br/>
        <sub>⭐ 14.6K</sub>
      </td>
      <td align="center" width="110">
        <a href="https://github.com/zeroclaw-labs/zeroclaw">
          <img src="./public/providers/zeroclaw.png" alt="ZeroClaw" width="48"/><br/>
          <b>ZeroClaw</b>
        </a><br/>
        <sub>⭐ 9.9K</sub>
      </td>
      <td align="center" width="110">
        <a href="https://github.com/nearai/ironclaw">
          <img src="./public/providers/ironclaw.png" alt="IronClaw" width="48"/><br/>
          <b>IronClaw</b>
        </a><br/>
        <sub>⭐ 2.1K</sub>
      </td>
    </tr>
    <tr>
      <td align="center" width="110">
        <a href="https://github.com/anomalyco/opencode">
          <img src="./public/providers/opencode.svg" alt="OpenCode" width="48"/><br/>
          <b>OpenCode</b>
        </a><br/>
        <sub>⭐ 106K</sub>
      </td>
      <td align="center" width="110">
        <a href="https://github.com/openai/codex">
          <img src="./public/providers/codex.png" alt="Codex CLI" width="48"/><br/>
          <b>Codex CLI</b>
        </a><br/>
        <sub>⭐ 60.8K</sub>
      </td>
      <td align="center" width="110">
        <a href="https://github.com/anthropics/claude-code">
          <img src="./public/providers/claude.png" alt="Claude Code" width="48"/><br/>
          <b>Claude Code</b>
        </a><br/>
        <sub>⭐ 67.3K</sub>
      </td>
      <td align="center" width="110">
        <a href="https://github.com/google-gemini/gemini-cli">
          <img src="./public/providers/gemini-cli.png" alt="Gemini CLI" width="48"/><br/>
          <b>Gemini CLI</b>
        </a><br/>
        <sub>⭐ 94.7K</sub>
      </td>
      <td align="center" width="110">
        <a href="https://github.com/Kilo-Org/kilocode">
          <img src="./public/providers/kilocode.png" alt="Kilo Code" width="48"/><br/>
          <b>Kilo Code</b>
        </a><br/>
        <sub>⭐ 15.5K</sub>
      </td>
    </tr>
  </table>

<sub>📡 Alla agenter ansluter via <code>http://localhost:20128/v1</code> eller <code>http://cloud.omniroute.online/v1</code>, —limited one config_245\_\_ kvot</sub>

---

### 🆕 What's New in v3.0.0

| Area                            | Change                                                                            |
| ------------------------------- | --------------------------------------------------------------------------------- |
| 🔒 **CodeQL Security**          | Fixed 10+ CodeQL alerts: polynomial-redos, insecure-randomness, shell-injection   |
| ✅ **Route Validation**         | All 176 API routes validated with Zod schemas + `validateBody()`                  |
| 🐛 **omniModel Tag Leak**       | Internal `<omniModel>` tags no longer leak to clients in SSE streams (#585)       |
| 🔑 **Registered Keys API**      | Auto-provision API keys via `POST /api/v1/registered-keys` with quota enforcement |
| 👁️ **Scoped API Key Reveal** 🆕 | Opt-in recovery of API keys via `ALLOW_API_KEY_REVEAL`                            |
| 🎨 **Provider Icons**           | 130+ provider logos via `@lobehub/icons` (SVG) with PNG fallback                  |
| 🔄 **Model Auto-Sync**          | 24h scheduler refreshes model lists for 16 providers                              |
| 🌐 **OpenCode Zen/Go**          | Two new providers: free tier + subscription tier                                  |
| 🔧 **926 Tests**                | Full test suite passes with 0 failures                                            |

### 🆕 What's New in v3.0.0

| Area                       | Change                                                                            |
| -------------------------- | --------------------------------------------------------------------------------- |
| 🔒 **CodeQL Security**     | Fixed 10+ CodeQL alerts: polynomial-redos, insecure-randomness, shell-injection   |
| ✅ **Route Validation**    | All 176 API routes validated with Zod schemas + `validateBody()`                  |
| 🐛 **omniModel Tag Leak**  | Internal `<omniModel>` tags no longer leak to clients in SSE streams (#585)       |
| 🔑 **Registered Keys API** | Auto-provision API keys via `POST /api/v1/registered-keys` with quota enforcement |
| 🎨 **Provider Icons**      | 130+ provider logos via `@lobehub/icons` (SVG) with PNG fallback                  |
| 🔄 **Model Auto-Sync**     | 24h scheduler refreshes model lists for 16 providers                              |
| 🌐 **OpenCode Zen/Go**     | Two new providers: free tier + subscription tier                                  |
| 🔧 **926 Tests**           | Full test suite passes with 0 failures                                            |

---

[![npm version](https://img.shields.io/npm/v/omniroute?color=cb3837&logo=npm)](https://www.npmjs.com/package/omniroute)
[![Docker Hub](https://img.shields.io/docker/v/diegosouzapw/omniroute?label=Docker%20Hub&logo=docker&color=2496ED)](https://hub.docker.com/r/diegosouzapw/omniroute)
[![License](https://img.shields.io/github/license/diegosouzapw/OmniRoute)](https://github.com/diegosouzapw/OmniRoute/blob/main/LICENSE)
[![Website](https://img.shields.io/badge/Website-omniroute.online-blue?logo=google-chrome&logoColor=white)](https://omniroute.online)
[![WhatsApp](https://img.shields.io/badge/WhatsApp-Community-25D366?logo=whatsapp&logoColor=white)](https://chat.whatsapp.com/JI7cDQ1GyaiDHhVBpLxf8b?mode=gi_t)

[🌐 Website](https://omniroute.online) • [🚀 Quick Start](#-quick-start) • [💡 Features](#-key-features) • [📖 Docs](#-documentation) • [💰 Pricing](#-pricing-at-a-glance) • [💬 WhatsApp](https://chat.whatsapp.com/JI7cDQ1GyaiDHhVBpLxf8b?mode=gi_t)

🌐 **Available in:** 🇺🇸 [English](../../README.md) | 🇧🇷 [Português (Brasil)](../pt-BR/README.md) | 🇪🇸 [Español](../es/README.md) | 🇫🇷 [Français](../fr/README.md) | 🇮🇹 [Italiano](../it/README.md) | 🇷🇺 [Русский](../ru/README.md) | 🇨🇳 [中文 (简体)](../zh-CN/README.md) | 🇩🇪 [Deutsch](../de/README.md) | 🇮🇳 [हिन्दी](../in/README.md) | 🇹🇭 [ไทย](../th/README.md) | 🇺🇦 [Українська](../uk-UA/README.md) | 🇸🇦 [العربية](../ar/README.md) | 🇯🇵 [日本語](../ja/README.md) | 🇻🇳 [Tiếng Việt](../vi/README.md) | 🇧🇬 [Български](../bg/README.md) | 🇩🇰 [Dansk](../da/README.md) | 🇫🇮 [Suomi](../fi/README.md) | 🇮🇱 [עברית](../he/README.md) | 🇭🇺 [Magyar](../hu/README.md) | 🇮🇩 [Bahasa Indonesia](../id/README.md) | 🇰🇷 [한국어](../ko/README.md) | 🇲🇾 [Bahasa Melayu](../ms/README.md) | 🇳🇱 [Nederlands](../nl/README.md) | 🇳🇴 [Norsk](../no/README.md) | 🇵🇹 [Português (Portugal)](../pt/README.md) | 🇷🇴 [Română](../ro/README.md) | 🇵🇱 [Polski](../pl/README.md) | 🇸🇰 [Slovenčina](../sk/README.md) | 🇸🇪 [Svenska](../sv/README.md) | 🇵🇭 [Filipino](../phi/README.md)

</div>

---

## 🖼️

<div align="center">
  <img src="./docs/screenshots/MainOmniRoute.png" alt="OmniRoute" width="800"/>
</div>

---

## 📸

<details>
<summary><b>...</b></summary>

| #     | #                                        |
| ----- | ---------------------------------------- |
| **1** | ![1](docs/screenshots/01-providers.png)  |
| **2** | ![2](docs/screenshots/02-combos.png)     |
| **3** | ![3](docs/screenshots/03-analytics.png)  |
| **4** | ![4](docs/screenshots/04-health.png)     |
| **5** | ![5](docs/screenshots/05-translator.png) |
| **6** | ![6](docs/screenshots/06-settings.png)   |
| **7** | ![7](docs/screenshots/07-cli-tools.png)  |
| **8** | ![8](docs/screenshots/08-usage.png)      |
| **9** | ![9](docs/screenshots/09-endpoint.png)   |

</details>

---

## 🤔 Varför OmniRoute?

**Sluta slösa pengar och nå gränser:**

- <img src="https://img.shields.io/badge/✗-e74c3c?style=flat-square" height="16"/> Prenumerationskvoten löper ut oanvänd varje månad
- <img src="https://img.shields.io/badge/✗-e74c3c?style=flat-square" height="16"/> Hastighetsgränser stoppar dig mellankodning
- <img src="https://img.shields.io/badge/✗-e74c3c?style=flat-square" height="16"/> Dyra API:er ($20-50/månad per leverantör)
- <img src="https://img.shields.io/badge/✗-e74c3c?style=flat-square" height="16"/> Manuellt byte mellan leverantörer

**OmniRoute löser detta:**

- ✅ **Maximera prenumerationer** - Spåra kvot, använd varje bit innan återställning
- ✅ **Automatisk reserv** - Prenumeration → API-nyckel → Billigt → Gratis, noll driftstopp
- ✅ **Multi-konto** - Round-robin mellan konton per leverantör
- ✅ **Universal** - Fungerar med Claude Code, Codex, Gemini CLI, Cursor, Cline, OpenClaw, vilket CLI-verktyg som helst

---

## 📧 Support

> 💬 **Gå med i vår community!** [WhatsApp Group](https://chat.whatsapp.com/JI7cDQ1GyaiDHhVBpLxf8b?mode=gi_t) — Få hjälp, dela tips och håll dig uppdaterad.

- **Webbplats**: [omniroute.online](https://omniroute.online)
- **GitHub**: [github.com/diegosouzapw/OmniRoute](https://github.com/diegosouzapw/OmniRoute)
- **Frågor**: [github.com/diegosouzapw/OmniRoute/issues](https://github.com/diegosouzapw/OmniRoute/issues)
- **WhatsApp**: [Community Group](https://chat.whatsapp.com/JI7cDQ1GyaiDHhVBpLxf8b?mode=gi_t)
- **Originalprojekt**: [9router by decolua](https://github.com/decolua/9router)

---

## 🔄 Hur det fungerar

```
┌─────────────┐
│  Your CLI   │  (Claude Code, Codex, Gemini CLI, OpenClaw, Cursor, Cline...)
│   Tool      │
└──────┬──────┘
       │ http://localhost:20128/v1
       ↓
┌─────────────────────────────────────────┐
│           OmniRoute (Smart Router)        │
│  • Format translation (OpenAI ↔ Claude) │
│  • Quota tracking + Embeddings + Images │
│  • Auto token refresh                   │
└──────┬──────────────────────────────────┘
       │
       ├─→ [Tier 1: SUBSCRIPTION] Claude Code, Codex, Gemini CLI
       │   ↓ quota exhausted
       ├─→ [Tier 2: API KEY] DeepSeek, Groq, xAI, Mistral, NVIDIA NIM, etc.
       │   ↓ budget limit
       ├─→ [Tier 3: CHEAP] GLM ($0.6/1M), MiniMax ($0.2/1M)
       │   ↓ budget limit
       └─→ [Tier 4: FREE] iFlow, Qwen, Kiro (unlimited)

Result: Never stop coding, minimal cost
```

---

## 🎯 Vad OmniRoute löser — 30 verkliga smärtpunkter och användningsfall

> **Varje utvecklare som använder AI-verktyg möter dessa problem dagligen.** OmniRoute byggdes för att lösa dem alla — från kostnadsöverskridanden till regionala block, från trasiga OAuth-flöden till protokolloperationer och observerbarhet i företag.

<details>
<summary><b>💸 1. "Jag betalar för ett dyrt abonnemang men blir ändå avbruten av limits" </b></summary>

Utvecklare betalar $20–200/månad för Claude Pro, Codex Pro eller GitHub Copilot. Även om du betalar har kvoten ett tak - 5 timmars användning, veckogränser eller gränser per minut. Mid-coding session, leverantören slutar svara och utvecklaren tappar flöde och produktivitet.

**Hur OmniRoute löser det:**

- **Smart 4-lagers fallback** — Om prenumerationskvoten tar slut, omdirigeras automatiskt till API-nyckel → Billigt → Gratis med noll manuellt ingrepp
- **Kvotspårning i realtid** — Visar tokenförbrukning i realtid med återställningsnedräkning (5 timmar, dagligen, veckovis)
- **Multi-Account Support** — Flera konton per leverantör med automatisk round-robin — när ett tar slut, byter du till nästa
- **Anpassade kombinationer** — Anpassningsbara reservkedjor med 6 balanseringsstrategier (fill-first, round-robin, P2C, slumpmässig, minst använda, kostnadsoptimerad)
- **Codex Business Quotas** — Övervakning av företags-/teamarbetsutrymmeskvoter direkt i instrumentpanelen

</details>

<details>
<summary><b>🔌 2. "Jag måste använda flera leverantörer men alla har olika API" </b></summary>

OpenAI använder ett format, Claude (Anthropic) använder ett annat, Gemini ännu ett annat. Om en utvecklare vill testa modeller från olika leverantörer eller fallback mellan dem måste de konfigurera om SDK:er, ändra slutpunkter, hantera inkompatibla format. Anpassade leverantörer (FriendLI, NIM) har icke-standardiserade modellslutpunkter.

**Hur OmniRoute löser det:**

- **Unified Endpoint** — En enda `http://localhost:20128/v1` fungerar som proxy för alla 36+ leverantörer
- **Formatöversättning** — Automatisk och transparent: OpenAI ↔ Claude ↔ Gemini ↔ Responses API
- **Responssanering** — Tar bort icke-standardiserade fält (`x_groq`, `usage_breakdown`, `service_tier`) som bryter OpenAI SDK v1.83+
- **Rollnormalisering** — Konverterar `developer` → `system` för icke-OpenAI-leverantörer; `system` → `user` för GLM/ERNIE
- **Think Tag Extraction** — Extraherar `<think>`-block från modeller som DeepSeek R1 till standardiserade `reasoning_content`
- **Structured Output for Gemini** — `json_schema` → `responseMimeType`/`responseSchema` automatisk konvertering
- **`stream` är standard till `false`** — Justerar med OpenAI-specifikationen, undviker oväntad SSE i Python/Rust/Go SDK:er

</details>

<details>
<summary><b>🌐 3. "Min AI-leverantör blockerar min region/land" </b></summary>

Leverantörer som OpenAI/Codex blockerar åtkomst från vissa geografiska regioner. Användare får fel som `unsupported_country_region_territory` under OAuth- och API-anslutningar. Detta är särskilt frustrerande för utvecklare från utvecklingsländer.

**Hur OmniRoute löser det:**

- **3-Level Proxy Config** — Konfigurerbar proxy på 3 nivåer: global (all trafik), per leverantör (endast en leverantör) och per anslutning/nyckel
- **Färgkodade proxymärken** — Visuella indikatorer: 🟢 global proxy, 🟡 leverantörsproxy, 🔵 anslutningsproxy, visar alltid IP:n
- **OAuth Token Exchange Through Proxy** — OAuth-flödet går också genom proxyn, vilket löser `unsupported_country_region_territory`
- **Anslutningstester via proxy** — Anslutningstester använder den konfigurerade proxyn (ingen mer direkt förbikoppling)
- **SOCKS5-stöd** — Fullständigt SOCKS5-proxystöd för utgående routing
- **TLS Fingerprint Spoofing** — Webbläsarliknande TLS-fingeravtryck via `wreq-js` för att kringgå botdetektering

</details>

<details>
<summary><b>🆓 4. "Jag vill använda AI för kodning men jag har inga pengar" </b></summary>

Alla kan inte betala $20–200/månad för AI-prenumerationer. Studenter, utvecklare från tillväxtländer, hobbyister och frilansare behöver tillgång till kvalitetsmodeller utan kostnad.

**Hur OmniRoute löser det:**

- **Gratis leverantörer inbyggda** — Inbyggt stöd för 100 % gratis leverantörer: iFlow (8 obegränsade modeller), Qwen (3 obegränsade modeller), Kiro (Claude gratis), Gemini CLI (180K/månad gratis)
- **Ollama Cloud** — Cloud-hosted Ollama models at `api.ollama.com` with free "Light usage" tier; use `ollamacloud/<model>` prefix
- **Free-Only Combos** — Chain `gc/gemini-3-flash → if/kimi-k2-thinking → qw/qwen3-coder-plus` = $0/månad utan stilleståndstid
- **NVIDIA NIM gratis krediter** — 1000 gratis krediter integrerade
- **Kostnadsoptimerad strategi** — Routingstrategi som automatiskt väljer den billigaste tillgängliga leverantören

</details>

<details>
<summary><b>🔒 5. "Jag behöver skydda min AI-gateway från obehörig åtkomst" </b></summary>

När du exponerar en AI-gateway för nätverket (LAN, VPS, Docker) kan vem som helst med adressen konsumera utvecklarens tokens/kvot. Utan skydd är API:er sårbara för missbruk, snabb injektion och missbruk.

**Hur OmniRoute löser det:**

- **API Key Management** — Generering, rotation och omfattning per leverantör med en dedikerad `/dashboard/api-manager`-sida
- **Behörigheter på modellnivå** — Begränsa API-nycklar till specifika modeller (`openai/*`, jokerteckenmönster), med växlaren Tillåt allt/Begränsa
- **API Endpoint Protection** — Kräv en nyckel för `/v1/models` och blockera specifika leverantörer från listan
- **Auth Guard + CSRF Protection** — Alla instrumentpanelsrutter skyddade med `withAuth` middleware + CSRF-tokens
- **Rate Limiter** — Per-IP-hastighetsbegränsning med konfigurerbara fönster
- **IP-filtrering** — Tillåtelselista/blockeringslista för åtkomstkontroll
- **Prompt Injection Guard** — Sanering mot skadliga promptmönster
- **AES-256-GCM-kryptering** — Autentiseringsuppgifter krypterade i vila

</details>

<details>
<summary><b>🛑 6. "Min leverantör gick ner och jag tappade mitt kodningsflöde" </b></summary>

AI-leverantörer kan bli instabila, returnera 5xx-fel eller nå tillfälliga hastighetsgränser. Om en utvecklare är beroende av en enskild leverantör avbryts de. Utan strömbrytare kan upprepade försök krascha programmet.

**Hur OmniRoute löser det:**

- **Circuit Breaker per leverantör** — Autoöppning/stängning med konfigurerbara trösklar och nedkylning (stängd/öppen/halvöppen)
- **Exponentiell backoff** — Progressiva fördröjningar igen
- **Anti-Thundering Herd** — Mutex + semaforskydd mot samtidiga stormar igen
- **Combo reservkedjor** — Om den primära leverantören misslyckas, faller den automatiskt genom kedjan utan ingrepp
- **Combo Circuit Breaker** - Inaktiverar automatiskt felande leverantörer inom en kombinationskedja
- **Health Dashboard** — Drifttidsövervakning, strömbrytartillstånd, låsningar, cachestatistik, p50/p95/p99 latens

</details>

<details>
<summary><b>🔧 7. "Att konfigurera varje AI-verktyg är tråkigt och repetitivt" </b></summary>

Utvecklare använder Cursor, Claude Code, Codex CLI, OpenClaw, Gemini CLI, Kilo Code... Varje verktyg behöver en annan konfiguration (API-slutpunkt, nyckel, modell). Att konfigurera om när man byter leverantör eller modell är ett slöseri med tid.

**Hur OmniRoute löser det:**

- **CLI Tools Dashboard** — Dedikerad sida med ett-klicksinställningar för Claude Code, Codex CLI, OpenClaw, Kilo Code, Antigravity, Cline
- **GitHub Copilot Config Generator** — Genererar `chatLanguageModels.json` för VS-kod med bulkmodellval
- **Onboarding Wizard** — Guidad 4-stegs installation för förstagångsanvändare
- **En slutpunkt, alla modeller** — Konfigurera `http://localhost:20128/v1` en gång, få tillgång till 36+ leverantörer

</details>

<details>
<summary><b>🔑 8. "Hantera OAuth-tokens från flera leverantörer är ett helvete" </b></summary>

Claude Code, Codex, Gemini CLI, Copilot — alla använder OAuth 2.0 med utgående tokens. Utvecklare måste autentisera på nytt hela tiden, hantera `client_secret is missing`, `redirect_uri_mismatch` och fel på fjärrservrar. OAuth på LAN/VPS är särskilt problematiskt.

**Hur OmniRoute löser det:**

- **Automatisk uppdatering av token** — OAuth-tokens uppdateras i bakgrunden innan de löper ut
- **OAuth 2.0 (PKCE) Inbyggd** — Automatiskt flöde för Claude Code, Codex, Gemini CLI, Copilot, Kiro, Qwen, iFlow
- **Multi-Account OAuth** — Flera konton per leverantör via JWT/ID-tokenextraktion
- **OAuth LAN/Remote Fix** — Privat IP-detektering för `redirect_uri` + manuellt URL-läge för fjärrservrar
- **OAuth Behind Nginx** — Använder `window.location.origin` för omvänd proxykompatibilitet
- **Remote OAuth Guide** — Steg-för-steg-guide för Google Cloud-uppgifter på VPS/Docker

</details>

<details>
<summary><b>📊 9. "Jag vet inte hur mycket jag spenderar eller var" </b></summary>

Utvecklare använder flera betalleverantörer men har ingen enhetlig syn på utgifter. Varje leverantör har sin egen faktureringspanel, men det finns ingen konsoliderad vy. Oväntade kostnader kan hopa sig.

**Hur OmniRoute löser det:**

- **Kostnadsanalysinstrumentpanel** — Kostnadsspårning per token och budgethantering per leverantör
- **Budgetgränser per nivå** — Utgiftstak per nivå som utlöser automatisk reserv
- **Priskonfiguration per modell** — Konfigurerbara priser per modell
- **Användningsstatistik per API-nyckel** — Antal förfrågningar och senast använda tidsstämpel per nyckel
- **Analytics Dashboard** — Statistikkort, modellanvändningsdiagram, leverantörstabell med framgångsfrekvens och latens

</details>

<details>
<summary><b>🐛 10. "Jag kan inte diagnostisera fel och problem i AI-samtal" </b></summary>

När ett samtal misslyckas vet inte utvecklaren om det var en hastighetsgräns, utgången token, fel format eller leverantörsfel. Fragmenterade loggar över olika terminaler. Utan observerbarhet är felsökning att trial-and-error.

**Hur OmniRoute löser det:**

- **Unified Logs Dashboard** — 4 flikar: Request Logs, Proxy Logs, Audit Logs, Console
- **Console Log Viewer** — Viewer i realtid i terminalstil med färgkodade nivåer, automatisk rullning, sökning, filtrering
- **SQLite Proxy-loggar** — Beständiga loggar som överlever serverstarter
- **Translator Playground** — 4 felsökningslägen: Playground (formatöversättning), Chat Tester (tur och retur), Testbänk (batch), Live Monitor (realtid)
- **Request Telemetri** — p50/p95/p99 latens + X-Request-Id-spårning
- **Filbaserad loggning med rotation** — Konsolinterceptor fångar allt till JSON-logg med storleksbaserad rotation

</details>

<details>
<summary><b>🏗️ 11. "Det är komplext att distribuera och underhålla gatewayen" </b></summary>

Att installera, konfigurera och underhålla en AI-proxy i olika miljöer (lokalt, VPS, Docker, moln) är arbetskrävande. Problem som hårdkodade sökvägar, `EACCES` på kataloger, portkonflikter och plattformsoberoende konstruktioner ger friktion.

**Hur OmniRoute löser det:**

- **npm global installation** — `npm install -g omniroute && omniroute` — klar
- **Docker Multi-Platform** — AMD64 + ARM64 inbyggt (Apple Silicon, AWS Graviton, Raspberry Pi)
- **Docker Compose Profiles** — `base` (inga CLI-verktyg) och `cli` (med Claude Code, Codex, OpenClaw)
- **Electron Desktop App** — Inbyggd app för Windows/macOS/Linux med systemfältet, autostart, offlineläge
- **Split-Port Mode** — API och Dashboard på separata portar för avancerade scenarier (omvänd proxy, containernätverk)
- **Cloud Sync** — Konfigurera synkronisering mellan enheter via Cloudflare Workers
- **DB-säkerhetskopior** — Automatisk säkerhetskopiering, återställning, export och import av alla inställningar

</details>

<details>
<summary><b>🌍 12. "Gränssnittet är endast engelska och mitt team talar inte engelska" </b></summary>

Lag i icke-engelsktalande länder, särskilt i Latinamerika, Asien och Europa, kämpar med enbart engelska gränssnitt. Språkbarriärer minskar användningen och ökar konfigurationsfelen.

**Hur OmniRoute löser det:**

- **Dashboard i18n — 30 språk** — Alla 500+ nycklar översatta, inklusive arabiska, bulgariska, danska, tyska, spanska, finska, franska, hebreiska, hindi, ungerska, indonesiska, italienska, japanska, koreanska, malaysiska, holländska, norska, polska, portugisiska (PT/BR), rumänska, ryska, thailändska, ukrainska, ukrainska, kinesiska, engelska, ukrainska, vietnamesiska, ukrainska, svenska, ukrainska
- **RTL-stöd** — Höger-till-vänster-stöd för arabiska och hebreiska
- **Multi-Language READMEs** — 30 fullständiga dokumentationsöversättningar
- **Språkväljare** — Globikon i rubriken för växling i realtid

</details>

<details>
<summary><b>🔄 13. "Jag behöver mer än chatt — jag behöver inbäddningar, bilder, ljud"</b></summary>

AI är inte bara att slutföra chatt. Utvecklare måste generera bilder, transkribera ljud, skapa inbäddningar för RAG, ranka om dokument och moderera innehåll. Varje API har olika slutpunkt och format.

**Hur OmniRoute löser det:**

- **Inbäddningar** — `/v1/embeddings` med 6 leverantörer och 9+ modeller
- **Bildgenerering** — `/v1/images/generations` med 10 leverantörer och 20+ modeller (OpenAI, xAI, Together, Fireworks, Nebius, Hyperbolic, NanoBanana, Antigravity, SD WebUI, ComfyUI)
- **Text-till-video** — `/v1/videos/generations` — ComfyUI (AnimateDiff, SVD) och SD WebUI
- **Text-to-Music** — `/v1/music/generations` — ComfyUI (Stable Audio Open, MusicGen)
- **Ljudtranskription** — `/v1/audio/transcriptions` — Whisper + Nvidia NIM, HuggingFace, Qwen3
- **Text-till-tal** — `/v1/audio/speech` — ElevenLabs, Nvidia NIM, HuggingFace, Coqui, Tortoise, Qwen3, Inworld, Cartesia, PlayHT, + befintliga leverantörer
- **Moderationer** — `/v1/moderations` — Innehållssäkerhetskontroller
- **Omrankning** — `/v1/rerank` — Omrankning av dokumentrelevans
- **Responses API** — Fullständigt `/v1/responses`-stöd för Codex

</details>

<details>
<summary><b>🧪 14. "Jag har inget sätt att testa och jämföra kvalitet mellan olika modeller" </b></summary>

Utvecklare vill veta vilken modell som är bäst för deras användningsfall - kod, översättning, resonemang - men det går långsamt att jämföra manuellt. Det finns inga integrerade utvärderingsverktyg.

**Hur OmniRoute löser det:**

- **LLM-utvärderingar** — Golden set-testning med 10 förinstallerade fall som täcker hälsningar, matematik, geografi, kodgenerering, JSON-efterlevnad, översättning, markdown, säkerhetsvägran
- **4 matchningsstrategier** — `exact`, `contains`, `regex`, `custom` (JS-funktion)
- **Translator Playground Test Bench** — Batchtestning med flera ingångar och förväntade utgångar, jämförelse mellan olika leverantörer
- **Chatttestare** — Fullständig tur och retur med visuell responsåtergivning
- **Live Monitor** — Realtidsström av alla förfrågningar som flödar genom proxyn

</details>

<details>
<summary><b>📈 15. "Jag behöver skala utan att förlora prestanda" </b></summary>

När förfrågningsvolymen ökar, utan att cachelagra genererar samma frågor dubbla kostnader. Utan idempotens, dubbletter begär avfallshantering. Prisgränser per leverantör måste respekteras.

**Hur OmniRoute löser det:**

- **Semantisk cache** — Tvåskiktscache (signatur + semantisk) minskar kostnaden och fördröjningen
- **Request Idempotency** — 5s dedupliceringsfönster för identiska förfrågningar
- **Rate Limit Detection** — RPM per leverantör, min gap och max samtidig spårning
- **Redigerbara hastighetsgränser** — Konfigurerbara standardinställningar i Inställningar → Motståndskraft med uthållighet
- **API Key Validation Cache** — 3-lagers cache för produktionsprestanda
- **Hälsoinstrumentpanel med telemetri** — p50/p95/p99 latens, cachestatistik, drifttid

</details>

<details>
<summary><b>🤖 16. "Jag vill kontrollera modellens beteende globalt" </b></summary>

Utvecklare som vill ha alla svar på ett specifikt språk, med en specifik ton, eller som vill begränsa resonemangstokens. Att konfigurera detta i varje verktyg/förfrågan är opraktiskt.

**Hur OmniRoute löser det:**

- **System Prompt Injection** — Global prompt tillämpas på alla förfrågningar
- **Thinking Budget Validation** — Reasoning token allocation control per request (passthrough, auto, custom, adaptive)
- **6 routingstrategier** — Globala strategier som avgör hur förfrågningar distribueras
- **Wildcard Router** — `provider/*`-mönster dirigerar dynamiskt till vilken leverantör som helst
- **Kombo Aktivera/Inaktivera Växla** — Växla kombinationer direkt från instrumentpanelen
- **Visa leverantör** — Aktivera/inaktivera alla anslutningar för en leverantör med ett klick
- **Blockerade leverantörer** — Uteslut specifika leverantörer från `/v1/models`-listan

</details>

<details>
<summary><b>🧰 17. "Jag behöver MCP-verktyg som förstklassiga produktegenskaper" </b></summary>

Många AI-gateways exponerar MCP endast som en dold implementeringsdetalj. Team behöver ett synligt, hanterbart driftlager.

**Hur OmniRoute löser det:**

- MCP visas på navigeringspanelen och fliken för slutpunktsprotokoll
- Dedikerad MCP-hanteringssida med process, verktyg, omfattningar och revision
- Inbyggd snabbstart för `omniroute --mcp` och klientintroduktion

</details>

<details>
<summary><b>🧠 18. "Jag behöver A2A-orkestrering med synkronisering + strömningsuppgiftsvägar" </b></summary>

Agentarbetsflöden kräver både direkta svar och långvarig streamad exekvering med livscykelkontroll.

**Hur OmniRoute löser det:**

- A2A JSON-RPC-ändpunkt (`POST /a2a`) med `message/send` och `message/stream`
- SSE-strömning med terminaltillståndspridning
- Task lifecycle API:er för `tasks/get` och `tasks/cancel`

</details>

<details>
<summary><b>🛰️ 19. "Jag behöver riktig MCP-processhälsa, inte gissad status" </b></summary>

Operativa team måste veta om MCP faktiskt lever, inte bara om ett API är tillgängligt.

**Hur OmniRoute löser det:**

- Runtime heartbeat-fil med PID, tidsstämplar, transport, verktygsräkning och scope-läge
- MCP status API som kombinerar hjärtslag + senaste aktivitet
- UI-statuskort för process/upptid/hjärtslagsnyhet

</details>

<details>
<summary><b>📋 20. "Jag behöver revisionsbart MCP-verktygsexekvering" </b></summary>

När verktyg muterar konfiguration eller utlöser operationsåtgärder behöver team rättsmedicinsk spårbarhet.

**Hur OmniRoute löser det:**

- SQLite-stödd revisionsloggning för MCP-verktygsanrop
- Filtrerar efter verktyg, framgång/misslyckande, API-nyckel och paginering
- Dashboard revisionstabell + statistikslutpunkter för automatisering

</details>

<details>
<summary><b>🔐 21. "Jag behöver scoped MCP-behörigheter per integration" </b></summary>

Olika klienter bör ha minst privilegierad åtkomst till verktygskategorier.

**Hur OmniRoute löser det:**

- 9 granulära MCP-scopes för kontrollerad verktygsåtkomst
- Tillämpning av omfattning och synlighet i MCP-hanteringsgränssnitt
- Säker standardställning för operativa verktyg

</details>

<details>
<summary><b>⚙️ 22. "Jag behöver driftskontroller utan att omdistribuera" </b></summary>

Team behöver snabba körtidsförändringar under incidenter eller kostnadshändelser.

**Hur OmniRoute löser det:**

- Växla kombinationsaktivering direkt från MCP-instrumentpanelen
- Tillämpa motståndskraftsprofiler från fördefinierade policypaket
- Återställ strömbrytarens tillstånd från samma manöverpanel

</details>

<details>
<summary><b>🔄 23. "I need live A2A task lifecycle synibility and cancellation"</b></summary>

Utan livscykelsynlighet blir uppgiftsincidenter svåra att triage.

**Hur OmniRoute löser det:**

- Uppgiftslista/filtrering efter stat/färdighet med sidnumrering
- Drill down på uppgiftens metadata, händelser och artefakter
- Slutpunkt för annullering av uppgifter och gränssnittsåtgärd med bekräftelse

</details>

<details>
<summary><b>🌊 24. "Jag behöver mätvärden för aktiv strömning för A2A-laddning" </b></summary>

Strömmande arbetsflöden kräver operativ insikt i samtidighet och direktanslutningar.

**Hur OmniRoute löser det:**

- Aktiva strömräknare integrerade i A2A-status
- Tidsstämpel för senaste uppgift och antal per stat
- A2A instrumentpanelskort för operationsövervakning i realtid

</details>

<details>
<summary><b>🪪 25. "Jag behöver standardagentupptäckt för klienter" </b></summary>

Externa klienter och orkestratorer behöver maskinläsbar metadata för onboarding.

**Hur OmniRoute löser det:**

- Agentkort exponerat på `/.well-known/agent.json`
- Förmåga och färdigheter som visas i ledningsgränssnittet
- A2A status API inkluderar upptäcktsmetadata för automatisering

</details>

<details>
<summary><b>🧭 26. "Jag behöver protokollupptäckbarhet i produktens UX" </b></summary>

Om användare inte kan upptäcka protokollytor, sjunker kvaliteten på adoption och support.

**Hur OmniRoute löser det:**

- Sidofältsposter för MCP och A2A
- Slutpunktssida Protokoll-fliken med snabbstart och status
- Länkar från översikt till dedikerade hanteringspaneler

</details>

<details>
<summary><b>🧪 27. "Jag behöver end-to-end protokollvalidering med riktiga klienter" </b></summary>

Mock-tester räcker inte för att validera protokollkompatibilitet före release.

**Hur OmniRoute löser det:**

- E2E-svit som startar appen och använder riktig MCP SDK-klienttransport
- A2A-klient testar för upptäckt, skicka, streama, hämta och avbryta flöden
- Korskontrollera påståenden mot MCP-revision och A2A-uppgifter API:er

</details>

<details>
<summary><b>📡 28. "Jag behöver enhetlig observerbarhet över alla gränssnitt" </b></summary>

Att dela upp observerbarheten enligt protokoll skapar blinda fläckar och längre MTTR.

**Hur OmniRoute löser det:**

- Enhetliga instrumentpaneler/loggar/analyser i en produkt
- Hälsa + revision + begäran om telemetri över OpenAI-, MCP- och A2A-lager
- Operativa API:er för status och automatisering

</details>

<details>
<summary><b>💼 29. "Jag behöver en körtid för proxy + verktyg + agentorkestrering" </b></summary>

Att köra många separata tjänster ökar driftskostnaderna och fellägen.

**Hur OmniRoute löser det:**

- OpenAI-kompatibel proxy, MCP-server och A2A-server i en stack
- Delad autentisering, resiliens, datalagring och observerbarhet
- Konsekvent policymodell över alla interaktionsytor

</details>

<details>
<summary><b>🚀 30. "Jag behöver skicka agentiska arbetsflöden utan limkodsprawl" </b></summary>

Lag tappar hastighet när de sammanfogar flera ad-hoc-tjänster och skript.

**Hur OmniRoute löser det:**

- Enhetlig slutpunktsstrategi för kunder och agenter
- Inbyggda gränssnitt för protokollhantering och rökvalideringsvägar
- Produktionsfärdiga grunder (säkerhet, loggning, resiliens, backup)

</details>

### Exempel på Playbooks (integrerade användningsfall)

**Playbook A: Maximera betald prenumeration + billig backup**

```txt
Combo: "maximize-claude"
  1. cc/claude-opus-4-6
  2. glm/glm-4.7
  3. if/kimi-k2-thinking

Monthly cost: $20 + small backup spend
Outcome: higher quality, near-zero interruption
```

**Playbook B: Noll-kostnad kodningsstack**

```txt
Combo: "free-forever"
  1. gc/gemini-3-flash
  2. if/kimi-k2-thinking
  3. qw/qwen3-coder-plus

Monthly cost: $0
Outcome: stable free coding workflow
```

**Playbook C: 24/7 alltid-på reservkedja**

```txt
Combo: "always-on"
  1. cc/claude-opus-4-6
  2. cx/gpt-5.2-codex
  3. glm/glm-4.7
  4. minimax/MiniMax-M2.1
  5. if/kimi-k2-thinking

Outcome: deep fallback depth for deadline-critical workloads
```

**Playbook D: Agent ops med MCP + A2A**

```txt
1) Start MCP transport (`omniroute --mcp`) for tool-driven operations
2) Run A2A tasks via `message/send` and `message/stream`
3) Observe via /dashboard/mcp and /dashboard/a2a
4) Control incidents with resilience profile + task cancellation
```

---

## ⚡ Snabbstart

**1. Installera globalt:**

```bash
npm install -g omniroute
omniroute
```

🎉 Instrumentpanelen öppnar kl. `http://localhost:20128`

| Kommando                | Beskrivning                        |
| ----------------------- | ---------------------------------- |
| `omniroute`             | Startserver (standardport 20128)   |
| `omniroute --port 3000` | Använd anpassad port               |
| `omniroute --no-open`   | Öppna inte webbläsaren automatiskt |
| `omniroute --help`      | Visa hjälp                         |

**2. Anslut en GRATIS leverantör:**

Dashboard → Leverantörer → Anslut **Claude Code** eller **Antigravity** → OAuth-inloggning → Klar!

**3. Använd i ditt CLI-verktyg:**

```
Claude Code/Codex/Gemini CLI/OpenClaw/Cursor/Cline Settings:
  Endpoint: http://localhost:20128/v1
  API Key: [copy from dashboard]
  Model: if/kimi-k2-thinking
```

**Det var allt!** Börja koda med GRATIS AI-modeller.

**Alternativ – kör från källan:**

```bash
cp .env.example .env
npm install
PORT=20128 NEXT_PUBLIC_BASE_URL=http://localhost:20128 npm run dev
```

---

## 🐳 Hamnarbetare

OmniRoute är tillgänglig som en offentlig Docker-bild på [Docker Hub](https://hub.docker.com/r/diegosouzapw/omniroute).

**Snabbkörning:**

```bash
docker run -d \
  --name omniroute \
  --restart unless-stopped \
  -p 20128:20128 \
  -v omniroute-data:/app/data \
  diegosouzapw/omniroute:latest
```

**Med miljöfil:**

```bash
# Copy and edit .env first
cp .env.example .env

docker run -d \
  --name omniroute \
  --restart unless-stopped \
  --env-file .env \
  -p 20128:20128 \
  -v omniroute-data:/app/data \
  diegosouzapw/omniroute:latest
```

**Använda Docker Compose:**

```bash
# Base profile (no CLI tools)
docker compose --profile base up -d

# CLI profile (Claude Code, Codex, OpenClaw built-in)
docker compose --profile cli up -d
```

| Bild                     | Tagga    | Storlek | Beskrivning             |
| ------------------------ | -------- | ------- | ----------------------- |
| `diegosouzapw/omniroute` | `latest` | ~250MB  | Senaste stabila utgåvan |
| `diegosouzapw/omniroute` | `1.0.3`  | ~250MB  | Aktuell version         |

---

---

## 🖥️

> 🆕 **NEW!** OmniRoute is now available as a **native desktop application** for Windows, macOS, and Linux.

- 🖥️ **Native Window** — Dedicated app window with system tray integration
- 🔄 **Auto-Start** — Launch OmniRoute on system login
- 🔔 **Native Notifications** — Get alerts for quota exhaustion or provider issues
- ⚡ **One-Click Install** — NSIS (Windows), DMG (macOS), AppImage (Linux)
- 🌐 **Offline Mode** — Works fully offline with bundled server

```bash
npm run electron:dev           # Development mode
npm run electron:build         # Current platform
npm run electron:build:win     # Windows (.exe)
npm run electron:build:mac     # macOS (.dmg)
npm run electron:build:linux   # Linux (.AppImage)
```

📖 Full documentation: [`electron/README.md`](electron/README.md)

---

## 💰 Prissättning i en överblick

| Nivå                 | Leverantör        | Kostnad                 | Kvotåterställning        | Bäst för                |
| -------------------- | ----------------- | ----------------------- | ------------------------ | ----------------------- |
| **💳 PRENUMERATION** | Claude Code (Pro) | 20 USD/månad            | 5h + veckovis            | Har redan prenumererat  |
|                      | Codex (Plus/Pro)  | 20-200 USD/månad        | 5h + veckovis            | OpenAI-användare        |
|                      | Gemini CLI        | **GRATIS**              | 180K/månad + 1K/dag      | Alla!                   |
|                      | GitHub Copilot    | 10-19 USD/månad         | Månatlig                 | GitHub-användare        |
| **🔑 API-NYCKEL**    | NVIDIA NIM        | **GRATIS** (1000 poäng) | Engång                   | Gratis nivåtestning     |
|                      | DeepSeek          | Betala per användning   | Inga                     | Bästa pris/kvalitet     |
|                      | Groq              | Gratis nivå + betald    | Begränsat pris           | Ultrasnabb slutledning  |
|                      | xAI (Grok)        | Betala per användning   | Inga                     | Grok modeller           |
|                      | Mistral           | Gratis nivå + betald    | Begränsat pris           | Europeisk AI            |
|                      | OpenRouter        | Betala per användning   | Inga                     | 100+ modeller           |
| **💰 BILLIGT**       | GLM-4.7           | $0,6/1M                 | Dagligen 10:00           | Budget backup           |
|                      | MiniMax M2.1      | $0,2/1M                 | 5-timmars rullande       | Billigaste alternativet |
|                      | Kimi K2           | 9 USD/mån lägenhet      | 10 miljoner tokens/månad | Förutsägbar kostnad     |
| **🆓 GRATIS**        | iFlow             | $0                      | Obegränsad               | 8 modeller gratis       |
|                      | Qwen              | $0                      | Obegränsad               | 3 modeller gratis       |
|                      | Kiro              | $0                      | Obegränsad               | Claude gratis           |

**💡 Proffstips:** Börja med Gemini CLI (180K gratis/månad) + iFlow (obegränsat gratis) combo = $0 kostnad!

---

## 💡 Nyckelfunktioner

### 🧠 Core Routing & Intelligence

| Funktion                       | Vad det gör                                                                               |
| ------------------------------ | ----------------------------------------------------------------------------------------- |
| 🎯 **Smart 4-lagers reserv**   | Automatisk rutt: Prenumeration → API-nyckel → Billigt → Gratis                            |
| 📊 **Kvotspårning i realtid**  | Live token count + återställ nedräkning per leverantör                                    |
| 🔄 **Formatöversättning**      | OpenAI ↔ Claude ↔ Gemini ↔ Markör ↔ Kiro sömlös + sanering av svar                        |
| 👥 **Multi-Account Support**   | Flera konton per leverantör med intelligent urval                                         |
| 🔄 **Auto Token Refresh**      | OAuth-tokens uppdateras automatiskt med försök igen                                       |
| 🎨 **Anpassade kombinationer** | 6 strategier: fill-first, round-robin, p2c, slumpmässig, minst använda, kostnadsoptimerad |
| 🧩 **Anpassade modeller**      | Lägg till valfritt modell-ID till valfri leverantör                                       |
| 🌐 **Wildcard-router**         | Dirigera `provider/*`-mönster till valfri leverantör dynamiskt                            |
| 🧠 **Tänkande budget**         | Genomgång, auto, anpassade och adaptiva lägen för resonerande modeller                    |
| 🔀 **Model Aliases**           | Auto-forward deprecated model IDs to current replacements (built-in + custom)             |
| ⚡ **Background Degradation**  | Auto-route background tasks (titles, summaries) to cheaper models                         |
| 💬 **System Prompt Injection** | Global systemprompt tillämpas på alla förfrågningar                                       |
| 📄 **Responses API**           | Fullständigt stöd för OpenAI Responses API (`/v1/responses`) för Codex                    |

### 🎵 Multimodala API:er

| Funktion                 | Vad det gör                                                                                                                                                                |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 🖼️ **Bildgenerering**    | `/v1/images/generations` — 4 leverantörer, 9+ modeller                                                                                                                     |
| 📐 **Inbäddningar**      | `/v1/embeddings` — 6 leverantörer, 9+ modeller                                                                                                                             |
| 🎤 **Ljudtranskription** | `/v1/audio/transcriptions` — 7 providers (Deepgram Nova 3, AssemblyAI, Groq Whisper, HuggingFace, ElevenLabs, OpenAI, Azure), auto-language detection, MP4/MP3/WAV support |
| 🔊 **Text-till-tal**     | `/v1/audio/speech` — 10 providers (ElevenLabs, OpenAI, Deepgram, Cartesia, PlayHT, HuggingFace, Nvidia NIM, Inworld, Coqui, Tortoise)                                      |
| 🛡️ **Moderationer**      | `/v1/moderations` — Innehållssäkerhetskontroller                                                                                                                           |
| 🔀 **Omrankning**        | `/v1/rerank` — Omrankning av dokumentrelevans                                                                                                                              |

### 🛡️ Motståndskraft och säkerhet

| Funktion                               | Vad det gör                                                                            |
| -------------------------------------- | -------------------------------------------------------------------------------------- |
| 🔌 **Circuit Breaker**                 | Autoöppna/stäng per leverantör med konfigurerbara trösklar                             |
| 🎯 **Endpoint-Aware Models**           | Custom models declare supported endpoints + API format                                 |
| 🛡️ **Anti-ånflock**                    | Mutex + semaforhastighetsgräns för API-nyckelleverantörer                              |
| 🧠 **Semantisk cache**                 | Tvåskiktscache (signatur + semantisk) minskar kostnaden och fördröjningen              |
| ⚡ **Begär idempotens**                | 5s dedup-fönster för dubblettförfrågningar                                             |
| 🔒 **TLS Fingerprint Spoofing**        | Förbi TLS-baserad botdetektering via wreq-js                                           |
| 🔏 **CLI Fingerprint Matching**        | Matches native CLI request signatures — **reduces ban risk while preserving proxy IP** |
| 🌐 **IP-filtrering**                   | Tillåtelselista/blockeringslista för API-åtkomstkontroll                               |
| 📊 **Redigerbara hastighetsgränser**   | Konfigurerbart RPM, min gap och max samtidiga på systemnivå                            |
| 💾 **Rate Limit Persistence**          | Learned limits survive restarts via SQLite with 60s debounce + 24h staleness           |
| 🔄 **Token Refresh Resilience**        | Per-provider circuit breaker (5 fails→30min) + 30s timeout per attempt                 |
| 🛡 **API Endpoint Protection**         | Auth gating + leverantörsblockering för `/models` slutpunkt                            |
| 🔒 **Proxysynlighet**                  | Färgkodade märken: 🟢 global, 🟡 leverantör, 🔵 per anslutning med IP-display          |
| 🌐 **Proxykonfiguration med 3 nivåer** | Konfigurera proxyservrar på global nivå, per leverantör eller per anslutningsnivå      |

### 📊 Observerbarhet och analys

| Funktion                         | Vad det gör                                                                   |
| -------------------------------- | ----------------------------------------------------------------------------- |
| 📝 **Begär loggning**            | Felsökningsläge med fullständiga förfrågnings-/svarsloggar                    |
| 📉 **Streamed Detailed Logs** 🆕 | Reconstructs SSE payload streams cleanly into the UI                          |
| 💾 **SQLite proxyloggar**        | Beständiga proxyloggar överlever serverstarter                                |
| 📊 **Analytics Dashboard**       | Recharts-driven: statistikkort, modellanvändningsdiagram, leverantörstabell   |
| 📈 **Förloppsspårning**          | Opt-in SSE-förloppshändelser för streaming                                    |
| 🧪 **LLM-utvärderingar**         | Golden set testning med 4 matchstrategier                                     |
| 🔍 **Begär telemetri**           | p50/p95/p99 latensaggregation + X-Request-Id-spårning                         |
| 📋 **Dashboard för loggar**      | Enad sida med 4 flikar: Begäranloggar, Proxyloggar, Granskningsloggar, Konsol |
| 🖥️ **Konsolloggvisare**          | Realtidsvisare i terminalstil med nivåfilter, sökning, automatisk rullning    |
| 📑 **Filbaserad loggning**       | Console Interceptor fångar all utdata till JSON-loggfilen med rotation        |
| 🏥 **Hälsoinstrumentpanel**      | Systemupptid, strömbrytartillstånd, låsningar, cachestatistik                 |
| 💰 **Kostnadsspårning**          | Budgethantering + prissättning per modell                                     |

### ☁️ Implementering och synkronisering

| Funktion                         | Vad det gör                                                                            |
| -------------------------------- | -------------------------------------------------------------------------------------- |
| 💾 **Cloud Sync**                | Synkronisera konfiguration mellan enheter via Cloudflare Workers                       |
| 🌐 **Distribuera var som helst** | Localhost, VPS, Docker, Cloudflare Workers                                             |
| 🔑 **API-nyckelhantering**       | Generera, rotera och omfång API-nycklar per leverantör                                 |
| 🧙 **Onboarding Wizard**         | 4-stegs guidad installation för förstagångsanvändare                                   |
| 🔧 **CLI Tools Dashboard**       | Konfigurera med ett klick Claude, Codex, Cline, OpenClaw, Kilo, Antigravity            |
| 🔄 **DB-säkerhetskopior**        | Automatisk säkerhetskopiering, återställning, export och import för alla inställningar |
| 🌐 **Internationalisering**      | Fullständig i18n med nästa-intl — stöd för engelska + portugisiska (Brasilien)         |
| 🌍 **Språkväljare**              | Globikon i rubriken för språkväxling i realtid (🇺🇸/🇧🇷)                                 |
| 🧹 **Clear All Models**          | One-click model list clearing in provider details                                      |
| 👁️ **Sidebar Controls** 🆕       | Hide components and integrations from Appearance Settings                              |
| 📋 **Issue Templates**           | Standardized GitHub templates for bugs and features                                    |
| 📂 **Anpassad datakatalog**      | `DATA_DIR` env var för att åsidosätta standard `~/.omniroute` lagringssökväg           |

<details>
<summary><b>📖 Funktionsdetaljer</b></summary>

### 🎯 Smart 4-lagers reserv

Skapa kombinationer med automatisk reserv:

```
Combo: "my-coding-stack"
  1. cc/claude-opus-4-6        (your subscription)
  2. nvidia/llama-3.3-70b      (free NVIDIA API)
  3. glm/glm-4.7               (cheap backup, $0.6/1M)
  4. if/kimi-k2-thinking       (free fallback)

→ Auto switches when quota runs out or errors occur
```

### 📊 Kvotspårning i realtid

- Tokenförbrukning per leverantör
- Återställ nedräkningen (5 timmar, dagligen, veckovis)
- Kostnadsuppskattning för betalda nivåer
- Månatliga utgiftsrapporter

### 🔄 Formatöversättning

Sömlös översättning mellan format:

- **OpenAI** ↔ **Claude** ↔ **Gemini** ↔ **OpenAI-svar**
- Ditt CLI-verktyg skickar OpenAI-format → OmniRoute översätter → Leverantör tar emot inbyggt format
- Fungerar med alla verktyg som stöder anpassade OpenAI-slutpunkter
- **Responssanering** — Tar bort icke-standardiserade fält för strikt OpenAI SDK-kompatibilitet
- **Rollnormalisering** — `developer` → `system` för icke-OpenAI; `system` → `user` för GLM/ERNIE-modeller
- **Think tag extrahering** — `<think>` block → `reasoning_content` för tänkande modeller
- **Structured output** — `json_schema` → Gemini's `responseMimeType`/`responseSchema`

### 👥 Support för flera konton

- Lägg till flera konton per leverantör
- Auto round-robin eller prioritetsbaserad routing
- Fallback till nästa konto när man når kvoten

### 🔄 Auto Token Refresh

- OAuth-tokens uppdateras automatiskt innan utgången
- Ingen manuell återautentisering behövs
- Sömlös upplevelse hos alla leverantörer

### 🎨 Anpassade kombinationer

- Skapa obegränsade modellkombinationer
- 6 strategier: fyll-först, round-robin, kraft-av-två-val, slumpmässig, minst använda, kostnadsoptimerad
- Dela kombinationer mellan enheter med Cloud Sync

### 🏥 Health Dashboard

- Systemstatus (upptid, version, minnesanvändning)
- Strömbrytarstatus per leverantör (stängd/öppen/halvöppen)
- Prisgränsstatus och aktiva låsningar
- Signaturcachestatistik
- Latens-telemetri (p50/p95/p99) + promptcache
- Återställ hälsostatus med ett klick

### 🔧 Översättarlekplats

OmniRoute inkluderar en kraftfull inbyggd översättarlekplats med **4 lägen** för felsökning, testning och övervakning av API-översättningar:

| Läge                | Beskrivning                                                                                                                                                                                                                                |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **💻 Lekplats**     | Direkt formatöversättning — klistra in valfri API-begäran och se direkt hur OmniRoute översätter den mellan leverantörsformat (OpenAI ↔ Claude ↔ Gemini ↔ Responses API). Inkluderar exempelmallar och automatisk identifiering av format. |
| **💬 Chattestare**  | Skicka riktiga chattförfrågningar genom OmniRoute och se hela tur och retur: din input, den översatta begäran, leverantörens svar och det översatta svaret tillbaka. Ovärderligt för att validera combo routing.                           |
| **🧪 Testbänk**     | Batchtestläge — definiera flera testfall med olika ingångar och förväntade utgångar, kör dem alla på en gång och jämför resultat mellan leverantörer och modeller.                                                                         |
| **📱 Live Monitor** | Bevakning av förfrågningar i realtid — titta på inkommande förfrågningar när de flödar genom OmniRoute, se formatöversättningar som sker live och identifiera problem direkt.                                                              |

**Åtkomst:** Instrumentpanel → Översättare (sidofält)

### 💾 Cloud Sync

- Synkronisera leverantörer, kombinationer och inställningar mellan enheter
- Automatisk bakgrundssynkronisering
- Säker krypterad lagring

</details>

## 🧪 Utvärderingar (Evals)

OmniRoute inkluderar ett inbyggt utvärderingsramverk för att testa LLM-svarskvalitet mot en gyllene uppsättning. Få åtkomst till det via **Analytics → Evals** i instrumentpanelen.

### Inbyggt gyllene set

Det förinstallerade "OmniRoute Golden Set" innehåller 10 testfall som täcker:

- Hälsningar, matematik, geografi, kodgenerering
- JSON-formatöverensstämmelse, översättning, markdown
- Säkerhetsvägran (skadligt innehåll), räkning, boolesk logik

### Utvärderingsstrategier

| Strategi   | Beskrivning                                          | Exempel                          |
| ---------- | ---------------------------------------------------- | -------------------------------- |
| `exact`    | Utdata måste matcha exakt                            | `"4"`                            |
| `contains` | Utdata måste innehålla delsträng (skiftlägeskänslig) | `"Paris"`                        |
| `regex`    | Utdata måste matcha regexmönster                     | `"1.*2.*3"`                      |
| `custom`   | Anpassad JS-funktion returnerar true/false           | `(output) => output.length > 10` |

---

## 📖 Installationsguide

<details>
<summary><b>💳 Prenumerationsleverantörer</b></summary>

### Claude Code (Pro/Max)

```bash
Dashboard → Providers → Connect Claude Code
→ OAuth login → Auto token refresh
→ 5-hour + weekly quota tracking

Models:
  cc/claude-opus-4-6
  cc/claude-sonnet-4-5-20250929
  cc/claude-haiku-4-5-20251001
```

**Proffstips:** Använd Opus för komplexa uppgifter, Sonnet för snabbhet. OmniRoute spårar kvot per modell!

### OpenAI Codex (Plus/Pro)

```bash
Dashboard → Providers → Connect Codex
→ OAuth login (port 1455)
→ 5-hour + weekly reset

Models:
  cx/gpt-5.2-codex
  cx/gpt-5.1-codex-max
```

### Gemini CLI (GRATIS 180K/månad!)

```bash
Dashboard → Providers → Connect Gemini CLI
→ Google OAuth
→ 180K completions/month + 1K/day

Models:
  gc/gemini-3-flash-preview
  gc/gemini-2.5-pro
```

**Bäst värde:** Enorma gratis nivå! Använd detta före betalda nivåer.

### GitHub Copilot

```bash
Dashboard → Providers → Connect GitHub
→ OAuth via GitHub
→ Monthly reset (1st of month)

Models:
  gh/gpt-5
  gh/claude-4.5-sonnet
  gh/gemini-3-pro
```

</details>

<details>
<summary><b>🔑 API-nyckelleverantörer</b></summary>

### NVIDIA NIM (GRATIS 1000 krediter!)

1. Registrera dig: [build.nvidia.com](https://build.nvidia.com)
2. Få gratis API-nyckel (1000 slutsatspoäng ingår)
3. Dashboard → Lägg till leverantör → NVIDIA NIM:
   - API-nyckel: `nvapi-your-key`

**Modeller:** `nvidia/llama-3.3-70b-instruct`, `nvidia/mistral-7b-instruct` och 50+ till

**Proffstips:** OpenAI-kompatibelt API — fungerar sömlöst med OmniRoutes formatöversättning!

### DeepSeek

1. Registrera dig: [platform.deepseek.com](https://platform.deepseek.com)
2. Hämta API-nyckel
3. Dashboard → Lägg till leverantör → DeepSeek

**Modeller:** `deepseek/deepseek-chat`, `deepseek/deepseek-coder`

### Groq (gratis nivå tillgänglig!)

1. Registrera dig: [console.groq.com](https://console.groq.com)
2. Skaffa API-nyckel (gratis nivå ingår)
3. Dashboard → Lägg till leverantör → Groq

**Modeller:** `groq/llama-3.3-70b`, `groq/mixtral-8x7b`

**Proffstips:** Ultrasnabb slutledning — bäst för realtidskodning!

### OpenRouter (100+ modeller)

1. Registrera dig: [openrouter.ai](https://openrouter.ai)
2. Hämta API-nyckel
3. Dashboard → Lägg till leverantör → OpenRouter

**Modeller:** Få tillgång till 100+ modeller från alla större leverantörer genom en enda API-nyckel.

</details>

<details>
<summary><b>💰 Billiga leverantörer (backup)</b></summary>

### GLM-4.7 (Daglig återställning, $0,6/1M)

1. Registrera dig: [Zhipu AI](https://open.bigmodel.cn/)
2. Hämta API-nyckel från Coding Plan
3. Instrumentpanel → Lägg till API-nyckel:
   - Leverantör: `glm`
   - API-nyckel: `your-key`

**Använd:** `glm/glm-4.7`

**Proffstips:** Coding Plan erbjuder 3× kvot till 1/7 kostnad! Återställ dagligen 10:00.

### MiniMax M2.1 (5 timmars återställning, $0,20/1M)

1. Registrera dig: [MiniMax](https://www.minimax.io/)
2. Hämta API-nyckel
3. Instrumentpanel → Lägg till API-nyckel

**Använd:** `minimax/MiniMax-M2.1`

**Proffstips:** Billigaste alternativet för långa sammanhang (1M tokens)!

### Kimi K2 ($9/månad platt)

1. Prenumerera: [Moonshot AI](https://platform.moonshot.ai/)
2. Hämta API-nyckel
3. Instrumentpanel → Lägg till API-nyckel

**Använd:** `kimi/kimi-latest`

**Proffstips:** Fast $9/månad för 10 miljoner tokens = $0,90/1 miljon effektiv kostnad!

</details>

<details>
<summary><b>🆓 GRATIS leverantörer (nödbackup)</b></summary>

### iFlow (8 GRATIS modeller)

```bash
Dashboard → Connect iFlow
→ iFlow OAuth login
→ Unlimited usage

Models:
  if/kimi-k2-thinking
  if/qwen3-coder-plus
  if/glm-4.7
  if/minimax-m2
  if/deepseek-r1
```

### Qwen (3 GRATIS modeller)

```bash
Dashboard → Connect Qwen
→ Device code authorization
→ Unlimited usage

Models:
  qw/qwen3-coder-plus
  qw/qwen3-coder-flash
```

### Kiro (Claude FREE)

```bash
Dashboard → Connect Kiro
→ AWS Builder ID or Google/GitHub
→ Unlimited usage

Models:
  kr/claude-sonnet-4.5
  kr/claude-haiku-4.5
```

</details>

<details>
<summary><b>🎨 Skapa kombinationer</b></summary>

### Exempel 1: Maximera prenumeration → Billig backup

```
Dashboard → Combos → Create New

Name: premium-coding
Models:
  1. cc/claude-opus-4-6 (Subscription primary)
  2. glm/glm-4.7 (Cheap backup, $0.6/1M)
  3. minimax/MiniMax-M2.1 (Cheapest fallback, $0.20/1M)

Use in CLI: premium-coding
```

### Exempel 2: Endast gratis (noll kostnad)

```
Name: free-combo
Models:
  1. gc/gemini-3-flash-preview (180K free/month)
  2. if/kimi-k2-thinking (unlimited)
  3. qw/qwen3-coder-plus (unlimited)

Cost: $0 forever!
```

</details>

<details>
<summary><b>🔧 CLI-integration</b></summary>

### Markör IDE

```
Settings → Models → Advanced:
  OpenAI API Base URL: http://localhost:20128/v1
  OpenAI API Key: [from OmniRoute dashboard]
  Model: cc/claude-opus-4-6
```

### Claude Code

Använd sidan **CLI Tools** i instrumentpanelen för konfiguration med ett klick, eller redigera `~/.claude/settings.json` manuellt.

### Codex CLI

```bash
export OPENAI_BASE_URL="http://localhost:20128"
export OPENAI_API_KEY="your-omniroute-api-key"

codex "your prompt"
```

### OpenClaw

**Alternativ 1 — Instrumentpanel (rekommenderas):**

```
Dashboard → CLI Tools → OpenClaw → Select Model → Apply
```

**Alternativ 2 — Manuell:** Redigera `~/.openclaw/openclaw.json`:

```json
{
  "models": {
    "providers": {
      "omniroute": {
        "baseUrl": "http://127.0.0.1:20128/v1",
        "apiKey": "sk_omniroute",
        "api": "openai-completions"
      }
    }
  }
}
```

> **Obs!** OpenClaw fungerar endast med lokal OmniRoute. Använd `127.0.0.1` istället för `localhost` för att undvika problem med IPv6-upplösning.

### Cline / Fortsätt / RooCode

```
Settings → API Configuration:
  Provider: OpenAI Compatible
  Base URL: http://localhost:20128/v1
  API Key: [from OmniRoute dashboard]
  Model: if/kimi-k2-thinking
```

</details>

---

## 🐛 Felsökning

<details>
<summary><b>Klicka för att expandera felsökningsguide</b></summary>

**"Språkmodellen gav inga meddelanden"**

- Leverantörskvoten är slut → Kontrollera instrumentpanelens kvotföljare
- Lösning: Använd kombinationsalternativ eller byt till billigare nivå

**Taxebegränsning**

- Prenumerationskvot ute → Fallback till GLM/MiniMax
- Lägg till kombination: `cc/claude-opus-4-6 → glm/glm-4.7 → if/kimi-k2-thinking`

**OAuth-token har löpt ut**

- Automatisk uppdatering av OmniRoute
- Om problemen kvarstår: Dashboard → Leverantör → Återanslut

**Höga kostnader**

- Kontrollera användningsstatistik i Dashboard → Kostnader
- Byt primär modell till GLM/MiniMax
- Använd gratis nivå (Gemini CLI, iFlow) för icke-kritiska uppgifter

**Dashboard öppnas på fel port**

- Set `PORT=20128` och `NEXT_PUBLIC_BASE_URL=http://localhost:20128`

**Molnsynkroniseringsfel**

- Verifiera att `BASE_URL` pekar på din löpinstans
- Verifiera `CLOUD_URL` poäng till din förväntade molnslutpunkt
- Håll `NEXT_PUBLIC_*` värden i linje med värden på serversidan

**Första inloggningen fungerar inte**

- Kontrollera `INITIAL_PASSWORD` i `.env`
- Om det inte är inställt är reservlösenordet `123456`

**Inga förfrågningsloggar**

- Ställ in `ENABLE_REQUEST_LOGS=true` i `.env`

**Anslutningstest visar "Invalid" för OpenAI-kompatibla leverantörer**

- Många leverantörer exponerar inte en `/models` slutpunkt
- OmniRoute v1.0.6+ inkluderar reservvalidering via chattslutföranden
- Se till att baswebbadressen innehåller suffixet `/v1`

### 🔐 OAuth

<a name="oauth-em-servidor-remoto"></a>

> **⚠️ VIKTIGT för användning av OmniRoute med VPS/Docker/serverfjärrkontroll**

### Hur kan du göra Antigravity / Tvilling CLI på fjärrkontroller?

Os provedores **Antigravity** och **Gemini CLI** usam **Google OAuth 2.0** för autenticação. O Google exige que a `redirect_uri` usada no fluxo OAuth seja **exatamente** uma das URIs pré-cadastradas no Google Cloud Console do aplicativo.

Som credenciais OAuth embutidas no OmniRoute estão cadastradas **apenas para `localhost`**. Quando você acessa o OmniRoute em um servidor remoto (ex: `https://omniroute.meuservidor.com`), o Google rejeita a autenticação com:

```
Error 400: redirect_uri_mismatch
```

### Lösning: Konfigurera självständigt OAuth

Você precisa criar um **OAuth 2.0 Client ID** no Google Cloud Console com a URI do seu service.

#### Passo a passo

**1. Åtkomst till Google Cloud Console**

Abra: [https://console.cloud.google.com/apis/credentials](https://console.cloud.google.com/apis/credentials)

**2. Crie um novo OAuth 2.0 Client ID**

- Klicka på dem **"+ Skapa inloggningsuppgifter"** → **"OAuth-klient-ID"**
- Typo de aplicativo: **"Webbapplikation"**
- Namn: escolha qualquer nome (ex: `OmniRoute Remote`)

**3. Adicione som auktoriserade omdirigerings-URI**

Ingen campo **"Auktoriserade omdirigerings-URIs"**, adicione:

```
https://seu-servidor.com/callback
```

> Substitua `seu-servidor.com` pelo domínio ou IP do seu servidor (inclua a porta se necessário, ex: `http://45.33.32.156:20128/callback`).

**4. Spara e kopia som credenciais**

Após criar, o Google mostrará o **Client ID** e o **Client Secret**.

**5. Konfigurera som variáveis de ambiente**

No seu `.env` (ou nas variáveis de ambiente do Docker):

```bash
# Para Antigravity:
ANTIGRAVITY_OAUTH_CLIENT_ID=seu-client-id.apps.googleusercontent.com
ANTIGRAVITY_OAUTH_CLIENT_SECRET=GOCSPX-seu-secret

# Para Gemini CLI:
GEMINI_OAUTH_CLIENT_ID=seu-client-id.apps.googleusercontent.com
GEMINI_OAUTH_CLIENT_SECRET=GOCSPX-seu-secret
GEMINI_CLI_OAUTH_CLIENT_SECRET=GOCSPX-seu-secret
```

**6. Reinicie o OmniRoute**

```bash
# Se usando npm:
npm run dev

# Se usando Docker:
docker restart omniroute
```

**7. Tente conectar novamente**

Dashboard → Leverantörer → Antigravity (ou Gemini CLI) → OAuth

Agora o Google redirecionará corretamente para `https://seu-servidor.com/callback` e a autenticação funcionará.

---

### Lösning temporário (som configurar credenciais próprias)

Se não quiser criar credenciais próprias agora, ainda é possível usar o fluxo **manual de URL**:

1. O OmniRoute abrirá en URL de autorização till Google
2. Após você autorizar, o Google tentará redirecionar para `localhost` (que falha no servidor remoto)
3. **Kopiera en webbadress komplett** da barra de endereço do seu webbläsare (mesmo que a página não carregue)
4. Cole essa URL no campo que aparece no modal de conexão do OmniRoute
5. Klicka på **"Anslut"**

> Este workaround funciona porque o código de autorização na URL é válido independente do redirect ter carregado ou não.

</details>

---

## 🛠️

- **Körtid**: Node.js 18–22 LTS (⚠️ Node.js 24+ stöds **inte** — `better-sqlite3` inbyggda binärer är inkompatibla)
- **Språk**: TypeScript 5.9 — **100 % TypeScript** över `src/` och `open-sse/` (v1.0.6)
- **Framework**: Next.js 16 + React 19 + Tailwind CSS 4
- **Databas**: LowDB (JSON) + SQLite (domäntillstånd + proxyloggar)
- **Streaming**: Serversända händelser (SSE)
- **Auth**: OAuth 2.0 (PKCE) + JWT + API-nycklar
- **Test**: Node.js testlöpare (368+ enhetstester)
- **CI/CD**: GitHub-åtgärder (automatisk npm-publicering + Docker Hub vid release)
- **Webbplats**: [omniroute.online](https://omniroute.online)
- **Paket**: [npmjs.com/package/omniroute](https://www.npmjs.com/package/omniroute)
- **Docker**: [hub.docker.com/r/diegosouzapw/omniroute](https://hub.docker.com/r/diegosouzapw/omniroute)
- **Resiliens**: Strömbrytare, exponentiell backoff, anti-dundrande flock, TLS-spoofing

---

## 📖 Dokumentation

| Dokument                                     | Beskrivning                                                |
| -------------------------------------------- | ---------------------------------------------------------- |
| [User Guide](docs/USER_GUIDE.md)             | Leverantörer, kombinationer, CLI-integration, distribution |
| [API Reference](docs/API_REFERENCE.md)       | Alla slutpunkter med exempel                               |
| [Troubleshooting](docs/TROUBLESHOOTING.md)   | Vanliga problem och lösningar                              |
| [Architecture](docs/ARCHITECTURE.md)         | Systemarkitektur och interna delar                         |
| [Contributing](CONTRIBUTING.md)              | Utvecklingsupplägg och riktlinjer                          |
| [OpenAPI Spec](docs/openapi.yaml)            | OpenAPI 3.0-specifikation                                  |
| [Security Policy](SECURITY.md)               | Sårbarhetsrapportering och säkerhetsrutiner                |
| [VM Deployment](docs/VM_DEPLOYMENT_GUIDE.md) | Komplett guide: VM + nginx + Cloudflare-installation       |
| [Features Gallery](docs/FEATURES.md)         | Visuell visning av instrumentpanelen med skärmdumpar       |

### 📸 Förhandsgranskning av instrumentpanelen

<details>
<summary><b>Klicka för att se skärmdumpar på instrumentpanelen</b></summary>

| Sida                  | Skärmdump                                         |
| --------------------- | ------------------------------------------------- |
| **Leverantörer**      | ![Providers](docs/screenshots/01-providers.png)   |
| **Kombos**            | ![Combos](docs/screenshots/02-combos.png)         |
| **Analytics**         | ![Analytics](docs/screenshots/03-analytics.png)   |
| **Hälsa**             | ![Health](docs/screenshots/04-health.png)         |
| **Översättare**       | ![Translator](docs/screenshots/05-translator.png) |
| **Inställningar**     | ![Settings](docs/screenshots/06-settings.png)     |
| **CLI-verktyg**       | ![CLI Tools](docs/screenshots/07-cli-tools.png)   |
| **Användningsloggar** | ![Usage](docs/screenshots/08-usage.png)           |
| **Slutpunkt**         | ![Endpoint](docs/screenshots/09-endpoint.png)     |

</details>

---

## 🗺️

OmniRoute har **210+ funktioner planerade** över flera utvecklingsfaser. Här är nyckelområdena:

| Kategori                        | Planerade funktioner | Höjdpunkter                                                                                                  |
| ------------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------ |
| 🧠 **Routing & intelligens**    | 25+                  | Routning med lägsta latens, taggbaserad routing, kvotförhandskontroll, val av P2C-konto                      |
| 🔒 **Säkerhet och efterlevnad** | 20+                  | SSRF-härdning, cloaking av autentiseringsuppgifter, hastighetsgräns per endpoint, hanteringsnyckelomfattning |
| 📊 **Observerbarhet**           | 15+                  | OpenTelemetry-integration, kvotövervakning i realtid, kostnadsspårning per modell                            |
| 🔄 **Providerintegrationer**    | 20+                  | Dynamiskt modellregister, nedkylning av leverantörer, Codex för flera konton, Copilot-kvotanalys             |
| ⚡ **Prestanda**                | 15+                  | Dubbla cachelager, promptcache, svarscache, streaming keepalive, batch API                                   |
| 🌐 **Ekosystem**                | 10+                  | WebSocket API, config hot-reload, distribuerad config store, kommersiellt läge                               |

### 🔜 Kommer snart

- 🔗 **OpenCode Integration** — Inbyggt leverantörsstöd för OpenCode AI-kodnings-IDE
- 🔗 **TRAE Integration** — Fullständigt stöd för TRAE AI-utvecklingsramverket
- 📦 **Batch API** — Asynkron batchbearbetning för bulkförfrågningar
- 🎯 **Taggbaserad routing** — Ruttbegäranden baserade på anpassade taggar och metadata
- 💰 **Lägsta kostnadsstrategi** — Välj automatiskt den billigaste tillgängliga leverantören

> 📝 Fullständiga funktionsspecifikationer tillgängliga i [link](docs/new-features/) (217 detaljerade specifikationer)

---

## 👥 Bidragsgivare

[![Contributors](https://contrib.rocks/image?repo=diegosouzapw/OmniRoute&max=100&columns=20&anon=1)](https://github.com/diegosouzapw/OmniRoute/graphs/contributors)

### Hur man bidrar

1. Dela förvaret
2. Skapa din funktionsgren (`git checkout -b feature/amazing-feature`)
3. Bekräfta dina ändringar (`git commit -m 'Add amazing feature'`)
4. Tryck till grenen (`git push origin feature/amazing-feature`)
5. Öppna en Pull Request

Se [CONTRIBUTING.md](CONTRIBUTING.md) för detaljerade riktlinjer.

### Släpper en ny version

```bash
# Create a release — npm publish happens automatically
gh release create v1.0.6 --title "v1.0.6" --generate-notes
```

---

## 📊 Stjärnhistorik

## Stargazers over time

## [![Stargazers over time](https://starchart.cc/diegosouzapw/OmniRoute.svg?variant=adaptive)](https://starchart.cc/diegosouzapw/OmniRoute)

## 🙏 Tack

Speciellt tack till **[9router](https://github.com/decolua/9router)** av **[decolua](https://github.com/decolua)** — originalprojektet som inspirerade denna gaffel. OmniRoute bygger på den otroliga grunden med ytterligare funktioner, multimodala API:er och en fullständig TypeScript-omskrivning.

Särskilt tack till **[CLIProxyAPI](https://github.com/router-for-me/CLIProxyAPI)** — den ursprungliga Go-implementeringen som inspirerade denna JavaScript-port.

---

## 📄 Licens

MIT-licens - se [LICENSE](LICENSE) för detaljer.

---

<div align="center">
  <sub>Byggd med ❤️ för utvecklare som kodar 24/7</sub>
  <br/>
  <sub><a href="https://omniroute.online">omniroute.online</a></sub>
</div>
