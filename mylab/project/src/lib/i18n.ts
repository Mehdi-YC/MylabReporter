/**
 * Finnish (default) and English UI texts. Organism names stay in Latin and antibiotic codes
 * (WHONET) stay visible in both languages; ward and antibiotic names come from the dataset
 * (`nameFi` / `nameEn`, `nameFi` / `name`).
 */

export const LOCALES = ['fi', 'en'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'fi';
export const LOCALE_COOKIE = 'aei-locale';

export function isLocale(value: unknown): value is Locale {
	return LOCALES.includes(value as Locale);
}

const fi = {
	htmlLang: 'fi',
	product: 'Antibioottitehon indikaattori',
	partner: 'TYKS × MYLAB',
	footer:
		'AEI · Tyks Laboratoriot × Mylab · JunctionX Turku. Synteettinen aineisto; EARS-Net-luvut: ECDC.',
	language: 'Kieli / Language',
	nav: {
		label: 'Päävalikko',
		pulse: 'Resistenssi',
		anomalies: 'Poikkeamat',
		explorer: 'AEI-selain',
		antibiogram: 'Antibiogrammi',
		advisor: 'Empiirinen ohjaus',
		map: 'Kartta',
		ask: 'Kysy',
		status: 'Synkronoinnin tila',
		station: 'Osastopääte'
	},
	lastSync: 'Viimeisin synkronointi',
	dataUntil: 'tulokset',
	window: 'Aikaikkuna',
	w4: '4 viikkoa',
	w12: '12 kuukautta',
	w4Short: '4 vk',
	w12Short: '12 kk',
	ward: 'Osasto',
	allWards: 'Kaikki osastot',
	specimen: 'Näytetyyppi',
	allSpecimens: 'Kaikki näytetyypit',
	specimens: { urine: 'Virtsa', blood: 'Veri', wound: 'Haava' },
	organism: 'Mikrobi',
	onset: 'Alkuperä',
	onsetAll: 'Kaikki',
	onsetHospital: 'Sairaalasyntyinen (hoitopäivä ≥ 3)',
	onsetCommunity: 'Avohoito / alkuvaihe',
	asOf: 'Tilanne',
	update: 'Päivitä',
	insufficient: 'Liian vähän isolaatteja (n<30)',
	susceptible: 'Herkkä (S)',
	resistant: 'Resistentti (R)',
	resistanceRate: 'Resistenssiosuus',
	critical: 'Kriittinen',
	warning: 'Varoitus',
	sentinel: 'Sentinelli',
	clear: 'Ei poikkeamia',
	noDeviations: 'Ei merkittäviä poikkeamia viimeisen 4 viikon aikana',
	empiric: 'Empiirinen ohjaus',
	coverage: 'kattavuus 12 kk',
	notTested: 'ei raportoida',
	decisionSupport: 'Päätöksenteon tuki. Ei korvaa paikallisia hoitosuosituksia.',
	pulse: {
		title: 'Osaston pulssi',
		subtitle: (specimen: string) =>
			`${specimen} · ensimmäinen isolaatti potilasta, mikrobia ja näytetyyppiä kohden`,
		windows: (r: string, a: string) => `4 viikkoa: ${r} · 12 kuukautta: ${a}`,
		openAnomaly: 'Avaa poikkeamat',
		calm: 'AEI vertasi osaston viimeistä 4 viikkoa sen omaan edelliseen vuoteen. Mikään rypäs, sentinellitapaus tai resistenssin nousu ei ylittänyt kynnystä.',
		moreAlerts: (n: number) => `+ ${n} muuta poikkeamaa tällä osastolla`,
		kpiIsolates: 'Ensimmäiset isolaatit, 4 vk',
		kpiIsolatesSub: (n: number) => `12 kk: ${n}`,
		kpiAlerts: 'Avoimet poikkeamat',
		kpiAlertsSub: (c: number, w: number) => `${c} kriittinen · ${w} varoitusta`,
		kpiOnset: 'Sairaalasyntyiset, 4 vk',
		kpiOnsetSub: 'näyte hoitopäivänä 3 tai myöhemmin',
		kpiTop: 'Suurin nousu, 4 vk',
		kpiTopNone: 'ei merkitsevää nousua',
		tableTitle: 'Resistenssiosuus (R %) — 4 viikkoa vs 12 kuukautta',
		tableHint: 'Iso luku: valittu aikaikkuna · pieni: toinen aikaikkuna',
		legend:
			'R % = resistenttien osuus testatuista ensimmäisistä isolaateista. Punainen = merkitsevä nousu osaston omaan 12 kuukauteen nähden. – = ei raportoida tälle mikrobille.',
		trendTitle: 'Resistenssiosuus kuukausittain',
		baseline: (p: string) => `perustaso ${p}`,
		empiricSites: {
			cystitis: 'Kystiitti',
			febrile: 'Kuumeinen virtsatieinfektio',
			blood: 'Veriviljelypositiivinen infektio',
			wound: 'Iho- / haavainfektio'
		},
		noAdequate: 'Mikään yksittäinen lääke ei saavuta 80 %:n kattavuutta',
		adviceWarn: (drugs: string) =>
			`Aktiivinen poikkeama heikentää näitä vaihtoehtoja: ${drugs}. Katso empiirinen ohjaus.`,
		openAdvisor: 'Avaa empiirinen ohjaus',
		hospitalTitle: 'Kaikki osastot',
		noData: 'Ei isolaatteja valitulla rajauksella.',
		viewLabel: 'Näkymä',
		viewWard: 'Osaston mukaan',
		viewOrganism: 'Bakteerin mukaan',
		statusTitle: 'Osaston tilanne',
		giveTitle: 'Mitä antaa empiirisesti?',
		avoid: (drugs: string) => `Vältä nyt: ${drugs}.`,
		changesTitle: 'Mitä on muuttunut',
		noChanges: 'Ei merkitseviä resistenssin nousuja viimeisen 4 viikon aikana.',
		changeLine: (ab: string, now: string, before: string) =>
			`${ab}-resistenssi ${now} (tavallisesti ${before})`,
		tableByWard: (ward: string) => `Resistenssi (R %) · ${ward}`,
		tableByOrganism: (organism: string) => `${organism} · resistenssi osastoittain`,
		pickCell: 'Valitse solu nähdäksesi kehityksen 24 kuukauden ajalta.',
		trend24: 'Resistenssi kuukausittain, 24 kuukautta',
		thisWard: 'Tämä osasto',
		closeDetail: 'Sulje',
		details: 'Näytä taulukko ja kehitys'
	},
	alerts: {
		title: 'Poikkeamien inbox',
		intro:
			'Jokaista osastoa verrataan sen omaan edelliseen 12 kuukauteen. Ilmaisimet käyvät läpi viimeisen 4 viikon ensimmäiset isolaatit: resistenttien fenotyyppien rypäät, sentinellimikrobit (CPE, VRE), resistenssin nousut ja mikrobipiikit.',
		triage: (n: number, linked: number) =>
			`System-1-triage: ${n} signaalia ylitti kynnyksen${linked ? `, joista ${linked} koskee samoja potilaita kuin rypäs ja on ryhmitelty sen alle` : ''}.`,
		prevWeek: '← Viikko',
		nextWeek: 'Viikko →',
		replay: '▶ Toista',
		pause: '❚❚ Tauko',
		today: 'Tänään',
		history: 'Poikkeamahistoria: osasto × viikko',
		historyHint: 'valitse viikko nähdäksesi silloisen tilanteen',
		legendCritical: 'Kriittinen rypäs',
		legendWarning: 'Varoitus',
		legendSentinel: 'Yksittäinen sentinellitapaus (CPE / VRE)',
		legendNote: 'Poikkeama näkyy 4 viikkoa, niin kauan kuin sen tapaukset ovat ikkunassa.',
		situation: (d: string) => `Tilanne ${d}`,
		latest: 'uusin',
		counts: (c: number, w: number) => `${c} kriittistä · ${w} varoitusta`,
		weekEnding: 'viikko päättyy',
		levels: {
			critical: '● Hälytys',
			warning: '● Seuranta',
			sentinel: '◆ Sentinelli',
			none: '○ Ei poikkeamia'
		},
		none: (d: string) =>
			`Ei poikkeamia 4 viikon jaksolla, joka päättyy ${d}: kaikki osastot ovat tavanomaisella tasollaan.`
	},
	alert: {
		kinds: {
			sentinel: 'Sentinellimikrobi',
			'phenotype-cluster': 'Fenotyyppirypäs',
			'resistance-rise': 'Resistenssin nousu',
			'organism-surge': 'Mikrobipiikki'
		},
		titleSentinel: (ph: string, ward: string) => `${ph} todettu: ${ward}`,
		titleCluster: (ph: string, ward: string, n: number) =>
			`${ph}-rypäs, ${ward}: ${n} tapausta 4 viikossa`,
		titleRise: (org: string, ab: string, ward: string, p: string) =>
			`${org}: ${ab}-resistenssi ${p}, ${ward}`,
		titleSurge: (org: string, ward: string, n: number) =>
			`${org}-piikki, ${ward}: ${n} isolaattia 4 viikossa`,
		why: 'Miksi hälytys laukesi',
		observed: 'Havaittu 4 vk',
		expected: 'Odotettu',
		baseline: 'Perustaso 12 kk',
		whyCount: (obs: number, exp: string) =>
			`${obs} tapausta 4 viikossa, kun osaston oma edellinen 12 kk skaalattuna 4 viikkoon antaa odotusarvoksi ${exp} (Poisson).`,
		whyRise: (obs: string, n: number, exp: string) =>
			`${obs} testatuista ensimmäisistä isolaateista resistenttejä (n=${n}), osaston perustaso ${exp}.`,
		whySentinel:
			'CPE ja VRE ovat Suomessa harvinaisia: jokainen tapaus hälyttää ilman tilastollista testiä.',
		ruleCluster:
			'Kynnys: vähintään 3 tapausta ja p < 0,001 (varoitus) tai p < 0,00001 (kriittinen).',
		ruleRise:
			'Kynnys: nousu vähintään 20 %-yksikköä, ≥ 10 testattua, perustaso ≥ 30 isolaattia ja p < 0,0001.',
		ruleSurge: 'Kynnys: vähintään 8 isolaattia, 2,5-kertainen odotusarvoon nähden ja p < 0,00001.',
		hospitalOnset: 'Sairaalasyntyiset (hoitopäivä ≥ 3)',
		sameProfile: 'Identtinen herkkyysprofiili',
		commonStrain: 'mahdollinen yhteinen kanta',
		between: 'Tapaukset välillä',
		suggested: 'Ehdotus:',
		actions: {
			sentinel:
				'Kosketusvarotoimet, ilmoita infektioiden torjuntaan, seulo altistuneet paikallisen ohjeen mukaan.',
			'phenotype-cluster':
				'Ilmoita infektioiden torjuntaan; tarkista käsihygienia ja kosketusvarotoimet; harkitse seulontaa.',
			'resistance-rise':
				'Arvioi osaston empiirinen hoito uudelleen, kunnes signaali tasaantuu; etsi yhteistä lähdettä.',
			'organism-surge':
				'Etsi yhteistä lähdettä (laite, toimenpide, henkilökunta) infektioiden torjunnan kanssa.'
		},
		linked: 'Liittyy samaan rypääseen (samat potilaat)',
		openAntibiogram: 'Avaa resistenssinäkymä →',
		cases: (n: number) => `${n} tapaus${n > 1 ? 'ta' : ''}`,
		colDate: 'Päivä',
		colPatient: 'Potilas',
		colOrganism: 'Mikrobi',
		colSpecimen: 'Näyte',
		colOnset: 'Alkuperä',
		onsetHospital: 'sairaala',
		onsetCommunity: 'avohoito / alkuvaihe'
	},
	explorer: {
		title: 'AEI-selain',
		subtitle:
			'Resistenssiosuus osastoittain ja antibiooteittain. Prosentti näytetään vain, kun testattuja ensimmäisiä isolaatteja on vähintään 30.',
		matrix: (org: string, w: string) => `${org} · resistenssiosuus, ${w}`,
		selected: 'Valittu solu',
		resistantOf: 'resistenttejä',
		ci: '95 %:n LV',
		method:
			'Ensimmäinen isolaatti potilasta, mikrobia ja näytetyyppiä kohden (CLSI M39). Palkki = 95 %:n Wilsonin luottamusväli.',
		openTrend: 'Avaa kuukausitrendi antibiogrammissa',
		pick: 'Valitse solu nähdäksesi luottamusvälin.',
		legendLow: '< 10 %',
		legendMid: '10–24 %',
		legendHigh: '≥ 25 %'
	},
	status: {
		title: 'Synkronoinnin tila',
		subtitle:
			'AEI lukee laboratorion tulokset rinnakkaisena kerroksena. Kliiniset järjestelmät eivät huomaa sitä.',
		healthy: 'Kaikki tarkistukset kunnossa',
		issues: (n: number) => `${n} tarkistusta vaatii huomiota`,
		pipeline: 'Käsittelyketju',
		ok: 'OK',
		stages: [
			['Lähde', 'Laboratorion vienti tietokantaan, vain luku'],
			['Parseri', 'Viljelyt, isolaatit ja herkkyystulokset riveiksi'],
			['Muunnin', 'WHONET-koodit, EUCAST-tulkinta S/R'],
			['Kanoninen skeema', 'Potilas · viljely · isolaatti · tulos'],
			['Laskenta', 'Ensimmäiset isolaatit, 4 vk ja 12 kk ikkunat'],
			['System-1-triage', 'Rypäät, sentinellit, nousut, piikit']
		] as [string, string][],
		volumes: 'Aineisto',
		cultures: 'Viljelyt yhteensä',
		isolates: 'Isolaatit',
		results: 'Herkkyystulokset',
		results7: 'Herkkyystulokset, 7 vrk',
		cultures7: 'Uudet viljelyt, 7 vrk',
		latestDay: 'Viimeisin näytepäivä',
		refresh: 'Tietokannan tarkistusväli',
		loadedAt: 'Aineisto ladattu muistiin',
		version: 'Aineistoversio',
		checks: 'Laaduntarkistukset',
		footer:
			'Vain luku -yhteys: AEI ei kirjoita laboratorio- tai potilastietojärjestelmään. Jos lähde ei päivity, näkymät näyttävät viimeisimmän onnistuneen latauksen ajan.',
		checkLabels: {
			antibiotics: 'Kaikki antibioottikoodit tunnistettu',
			wards: 'Kaikki osastokoodit tunnistettu',
			dates: 'Ei tulevaisuuden näytepäiviä',
			orphans: 'Jokaisella herkkyystuloksella on isolaatti',
			guidelines: 'Tulkintaohje'
		}
	},
	chat: {
		open: 'Kysy AEI:ltä',
		title: 'Kysy laboratoriodatasta',
		intro:
			'Kysy suomeksi, englanniksi tai ranskaksi. Luvut lasketaan samoilla funktioilla kuin muualla AEI:ssa; kielimalli vain muotoilee ne.',
		placeholder: 'Kirjoita kysymys…',
		send: 'Lähetä',
		close: 'Sulje keskustelu',
		thinking: 'Haetaan tietoja…',
		writing: 'Kielimalli muotoilee vastausta…',
		computed: 'Laskettu vastaus',
		modelAnswer: 'Vastaus',
		openView: 'Avaa näkymä',
		context: (scope: string) => `Kysymys koskee: ${scope}`,
		ignoreContext: 'Älä rajaa sivun mukaan',
		askAbout: (org: string, ab: string, ward: string) =>
			`Miten ${org}-bakteerin ${ab}-resistenssi on kehittynyt osastolla ${ward}?`,
		ask: 'Kysy',
		checked: 'Kaikki luvut vastaavat laskettua dataa',
		unchecked: (n: string) => `Lukuja, joita ei löydy datasta: ${n}`,
		failed: 'Pyyntö epäonnistui.',
		examples: [
			'Miten Klebsiellan resistenssi kehittyy teho-osastolla?',
			'Onko teho-osastolla MRSA-rypäitä?',
			'Mitä antibioottia annan 78-vuotiaalle miehelle, jolla on kuumeinen virtsatieinfektio urologialla?'
		]
	},
	admin: {
		nav: 'Ylläpito',
		loginTitle: 'Ylläpitäjän kirjautuminen',
		loginIntro: 'Vain ylläpitäjät voivat tuoda laboratorion tiedostoja AEI:hin.',
		email: 'Sähköposti',
		password: 'Salasana',
		name: 'Nimi',
		signIn: 'Kirjaudu',
		createTitle: 'Luo ylläpitäjätili',
		createIntro: 'Vain ylläpitäjiksi määritellyille osoitteille (ADMIN_EMAILS).',
		create: 'Luo tili',
		notAllowed: 'Tätä osoitetta ei ole ylläpitäjien listalla.',
		failed: 'Kirjautuminen epäonnistui. Tarkista sähköposti ja salasana.',
		title: 'Tietojen tuonti',
		intro:
			'Lisää tai korjaa laboratorion tuloksia CSV-tiedostoilla. Sarakkeet ovat samat kuin aineiston tiedostoissa; tiedoston tyyppi tunnistetaan otsikkorivistä.',
		files: 'CSV-tiedostot',
		filesHint: 'Yksi tai useampi tiedosto kerrallaan.',
		check: 'Tarkista',
		import: 'Tuo tiedot',
		templates: 'Mallitiedostot',
		tables: {
			wards: 'Osastot',
			antibiotics: 'Antibiootit',
			patients: 'Potilaat',
			cultures: 'Viljelyt',
			isolates: 'Isolaatit',
			susceptibility: 'Herkkyystulokset'
		},
		checked: 'Tarkistettu – mitään ei tallennettu.',
		imported: (n: string) => `${n} riviä tallennettu.`,
		rejected: (n: string) => `${n} riviä hylätty.`,
		colFile: 'Tiedosto',
		colTable: 'Taulu',
		colRows: 'Rivejä',
		colValid: 'Kelvollisia',
		colUpdates: 'Päivityksiä',
		colErrors: 'Virheitä',
		line: 'rivi',
		unknownTable: 'tuntematon',
		history: 'Viimeisimmät tuonnit',
		noHistory: 'Ei tuonteja palvelimen käynnistyksen jälkeen.',
		signedInAs: (e: string) => `Kirjautunut: ${e}`,
		signOut: 'Kirjaudu ulos',
		order:
			'Tiedostot käsitellään järjestyksessä osastot → antibiootit → potilaat → viljelyt → isolaatit → herkkyystulokset, joten uusi viljely voi viitata samassa tuonnissa lisättyyn potilaaseen. Olemassa olevat rivit päivitetään.',
		after: 'Tuonnin jälkeen kaikki näkymät ja hälytykset lasketaan heti uudelleen.',
		dataNow: 'Aineisto nyt',
		openStatus: 'Synkronoinnin tila'
	},
	station: {
		updated: 'Päivitetty',
		calm: 'Ei merkittäviä poikkeamia viimeisen 4 viikon aikana',
		resTitle: 'resistenssiosuus',
		resLegend: 'palkki: 12 kk · viiva ja luku: 4 vk',
		footer:
			'Päivittyy automaattisesti. Päätöksenteon tuki – ei korvaa paikallisia hoitosuosituksia.',
		avoid: (drugs: string) => `Vältä nyt empiirisesti: ${drugs}.`,
		pickWard: 'Osasto'
	}
};

export type Messages = typeof fi;

const en: Messages = {
	htmlLang: 'en',
	product: 'Antibiotic Efficacy Indicator',
	partner: 'TYKS × MYLAB',
	footer:
		'AEI · Tyks Laboratories × Mylab · JunctionX Turku. Synthetic dataset; EARS-Net figures: ECDC.',
	language: 'Kieli / Language',
	nav: {
		label: 'Main menu',
		pulse: 'Resistance',
		anomalies: 'Anomalies',
		explorer: 'AEI Explorer',
		antibiogram: 'Antibiogram',
		advisor: 'Empiric guidance',
		map: 'Map',
		ask: 'Ask',
		status: 'Ingestion health',
		station: 'Ward station'
	},
	lastSync: 'Last sync',
	dataUntil: 'results',
	window: 'Time window',
	w4: '4 weeks',
	w12: '12 months',
	w4Short: '4 wk',
	w12Short: '12 mo',
	ward: 'Ward',
	allWards: 'All wards',
	specimen: 'Specimen type',
	allSpecimens: 'All specimen types',
	specimens: { urine: 'Urine', blood: 'Blood', wound: 'Wound' },
	organism: 'Organism',
	onset: 'Onset',
	onsetAll: 'All',
	onsetHospital: 'Hospital-onset (day ≥ 3)',
	onsetCommunity: 'Community / early',
	asOf: 'As of',
	update: 'Update',
	insufficient: 'Insufficient isolates (n<30)',
	susceptible: 'Susceptible (S)',
	resistant: 'Resistant (R)',
	resistanceRate: 'Resistance rate',
	critical: 'Critical',
	warning: 'Warning',
	sentinel: 'Sentinel',
	clear: 'No anomalies',
	noDeviations: 'No material deviations in the last 4 weeks',
	empiric: 'Empiric guidance',
	coverage: 'coverage 12 mo',
	notTested: 'not reported',
	decisionSupport: 'Decision support. Does not replace local treatment guidelines.',
	pulse: {
		title: 'Ward Pulse',
		subtitle: (specimen: string) =>
			`${specimen} · first isolate per patient, organism and specimen type`,
		windows: (r: string, a: string) => `4 weeks: ${r} · 12 months: ${a}`,
		openAnomaly: 'Open anomalies',
		calm: 'AEI compared the ward’s last 4 weeks with its own previous year. No cluster, sentinel case or resistance rise crossed a threshold.',
		moreAlerts: (n: number) => `+ ${n} more anomal${n > 1 ? 'ies' : 'y'} on this ward`,
		kpiIsolates: 'First isolates, 4 wk',
		kpiIsolatesSub: (n: number) => `12 mo: ${n}`,
		kpiAlerts: 'Open anomalies',
		kpiAlertsSub: (c: number, w: number) => `${c} critical · ${w} warning${w === 1 ? '' : 's'}`,
		kpiOnset: 'Hospital-onset, 4 wk',
		kpiOnsetSub: 'sampled on hospital day 3 or later',
		kpiTop: 'Largest rise, 4 wk',
		kpiTopNone: 'no significant rise',
		tableTitle: 'Resistance rate (R %) — 4 weeks vs 12 months',
		tableHint: 'Large: selected window · small: the other window',
		legend:
			'R % = share of tested first isolates that are resistant. Red = significant rise over the ward’s own 12 months. – = not reported for this organism.',
		trendTitle: 'Monthly resistance rate',
		baseline: (p: string) => `baseline ${p}`,
		empiricSites: {
			cystitis: 'Cystitis',
			febrile: 'Febrile urinary tract infection',
			blood: 'Bloodstream infection',
			wound: 'Skin / wound infection'
		},
		noAdequate: 'No single agent reaches 80% coverage',
		adviceWarn: (drugs: string) =>
			`An active anomaly weakens these options: ${drugs}. See empiric guidance.`,
		openAdvisor: 'Open empiric guidance',
		hospitalTitle: 'All wards',
		noData: 'No isolates for this selection.',
		viewLabel: 'View',
		viewWard: 'By ward',
		viewOrganism: 'By organism',
		statusTitle: 'Ward status',
		giveTitle: 'What to give empirically?',
		avoid: (drugs: string) => `Avoid for now: ${drugs}.`,
		changesTitle: 'What has changed',
		noChanges: 'No significant rise in resistance in the last 4 weeks.',
		changeLine: (ab: string, now: string, before: string) =>
			`${ab} resistance ${now} (usually ${before})`,
		tableByWard: (ward: string) => `Resistance (R %) · ${ward}`,
		tableByOrganism: (organism: string) => `${organism} · resistance by ward`,
		pickCell: 'Pick a cell to see its trend over 24 months.',
		trend24: 'Monthly resistance, 24 months',
		thisWard: 'This ward',
		closeDetail: 'Close',
		details: 'Show table and trend'
	},
	alerts: {
		title: 'Anomaly Inbox',
		intro:
			'Every ward is compared with its own previous 12 months. Detectors run on the last 4 weeks of first isolates: resistant-phenotype clusters, sentinel organisms (CPE, VRE), resistance rises and organism surges.',
		triage: (n: number, linked: number) =>
			`System-1 triage: ${n} signal${n === 1 ? '' : 's'} crossed a threshold${linked ? `; ${linked} involve the same patients as a cluster and are grouped under it` : ''}.`,
		prevWeek: '← Week',
		nextWeek: 'Week →',
		replay: '▶ Replay',
		pause: '❚❚ Pause',
		today: 'Today',
		history: 'Anomaly history: ward × week',
		historyHint: 'pick a week to see the situation at that time',
		legendCritical: 'Critical cluster',
		legendWarning: 'Warning',
		legendSentinel: 'Single sentinel case (CPE / VRE)',
		legendNote: 'An anomaly stays visible for the 4 weeks its cases are in the window.',
		situation: (d: string) => `Situation on ${d}`,
		latest: 'latest',
		counts: (c: number, w: number) => `${c} critical · ${w} warning${w === 1 ? '' : 's'}`,
		weekEnding: 'week ending',
		levels: { critical: '● Alert', warning: '● Watch', sentinel: '◆ Sentinel', none: '○ Clear' },
		none: (d: string) =>
			`No anomalies in the 4 weeks ending ${d}: every ward is within its usual range.`
	},
	alert: {
		kinds: {
			sentinel: 'Sentinel organism',
			'phenotype-cluster': 'Phenotype cluster',
			'resistance-rise': 'Resistance rise',
			'organism-surge': 'Organism surge'
		},
		titleSentinel: (ph: string, ward: string) => `${ph} detected: ${ward}`,
		titleCluster: (ph: string, ward: string, n: number) =>
			`${ph} cluster, ${ward}: ${n} cases in 4 weeks`,
		titleRise: (org: string, ab: string, ward: string, p: string) =>
			`${org}: ${ab} resistance ${p}, ${ward}`,
		titleSurge: (org: string, ward: string, n: number) =>
			`${org} surge, ${ward}: ${n} isolates in 4 weeks`,
		why: 'Why it fired',
		observed: 'Observed 4 wk',
		expected: 'Expected',
		baseline: 'Baseline 12 mo',
		whyCount: (obs: number, exp: string) =>
			`${obs} cases in 4 weeks, against ${exp} expected from the ward’s own previous 12 months scaled to 4 weeks (Poisson).`,
		whyRise: (obs: string, n: number, exp: string) =>
			`${obs} of tested first isolates resistant (n=${n}), against the ward’s baseline of ${exp}.`,
		whySentinel:
			'CPE and VRE are rare in Finland: every case raises an alert without a statistical test.',
		ruleCluster: 'Threshold: at least 3 cases and p < 0.001 (warning) or p < 0.00001 (critical).',
		ruleRise:
			'Threshold: rise of at least 20 percentage points, ≥ 10 tested, baseline ≥ 30 isolates and p < 0.0001.',
		ruleSurge: 'Threshold: at least 8 isolates, 2.5 times the expected count and p < 0.00001.',
		hospitalOnset: 'Hospital-onset (day ≥ 3)',
		sameProfile: 'Identical susceptibility profile',
		commonStrain: 'possible common strain',
		between: 'Cases between',
		suggested: 'Suggested:',
		actions: {
			sentinel:
				'Contact precautions, notify infection control, screen contacts per local guideline.',
			'phenotype-cluster':
				'Notify infection control; review hand hygiene and contact precautions; consider screening.',
			'resistance-rise':
				'Review empirical therapy for this ward until the signal settles; check for a common source.',
			'organism-surge':
				'Check for a common source (device, procedure, staff) with infection control.'
		},
		linked: 'Linked to the same cluster (same patients)',
		openAntibiogram: 'Open resistance view →',
		cases: (n: number) => `${n} case${n > 1 ? 's' : ''}`,
		colDate: 'Date',
		colPatient: 'Patient',
		colOrganism: 'Organism',
		colSpecimen: 'Specimen',
		colOnset: 'Onset',
		onsetHospital: 'hospital',
		onsetCommunity: 'community / early'
	},
	explorer: {
		title: 'AEI Explorer',
		subtitle:
			'Resistance rate by ward and antibiotic. A percentage is only shown when at least 30 first isolates were tested.',
		matrix: (org: string, w: string) => `${org} · resistance rate, ${w}`,
		selected: 'Selected cell',
		resistantOf: 'resistant',
		ci: '95% CI',
		method:
			'First isolate per patient, organism and specimen type (CLSI M39). Bar = 95% Wilson confidence interval.',
		openTrend: 'Open the monthly trend in the antibiogram',
		pick: 'Pick a cell to see its confidence interval.',
		legendLow: '< 10%',
		legendMid: '10–24%',
		legendHigh: '≥ 25%'
	},
	status: {
		title: 'Ingestion health',
		subtitle: 'AEI reads laboratory results as a shadow layer. Clinical systems are not affected.',
		healthy: 'All checks passed',
		issues: (n: number) => `${n} check${n === 1 ? '' : 's'} need attention`,
		pipeline: 'Processing chain',
		ok: 'OK',
		stages: [
			['Source', 'Laboratory export into the database, read-only'],
			['Parser', 'Cultures, isolates and susceptibility results into rows'],
			['Transformer', 'WHONET codes, EUCAST S/R interpretation'],
			['Canonical schema', 'Patient · culture · isolate · result'],
			['Computation', 'First isolates, 4-week and 12-month windows'],
			['System-1 triage', 'Clusters, sentinels, rises, surges']
		],
		volumes: 'Data',
		cultures: 'Cultures in total',
		isolates: 'Isolates',
		results: 'Susceptibility results',
		results7: 'Susceptibility results, 7 days',
		cultures7: 'New cultures, 7 days',
		latestDay: 'Latest sample date',
		refresh: 'Database check interval',
		loadedAt: 'Data loaded into memory',
		version: 'Data version',
		checks: 'Quality checks',
		footer:
			'Read-only connection: AEI never writes to the laboratory or patient record systems. If the source stops updating, every view shows the time of the last successful load.',
		checkLabels: {
			antibiotics: 'All antibiotic codes recognised',
			wards: 'All ward codes recognised',
			dates: 'No sample dates in the future',
			orphans: 'Every susceptibility result has an isolate',
			guidelines: 'Interpretation guideline'
		}
	},
	chat: {
		open: 'Ask AEI',
		title: 'Ask the laboratory data',
		intro:
			'Ask in English, Finnish or French. Figures are computed by the same functions as the rest of AEI; the language model only words them.',
		placeholder: 'Type a question…',
		send: 'Send',
		close: 'Close chat',
		thinking: 'Looking up the data…',
		writing: 'The language model is wording the answer…',
		computed: 'Computed answer',
		modelAnswer: 'Answer',
		openView: 'Open the view',
		context: (scope: string) => `Question about: ${scope}`,
		ignoreContext: 'Do not use the page filters',
		askAbout: (org: string, ab: string, ward: string) =>
			`How has ${org} resistance to ${ab} evolved in ${ward}?`,
		ask: 'Ask',
		checked: 'Every figure matches the computed data',
		unchecked: (n: string) => `Figures not found in the data: ${n}`,
		failed: 'The request failed.',
		examples: [
			'How is Klebsiella resistance evolving in ICU?',
			'Is there an MRSA cluster in ICU?',
			'What should I give a 78-year-old man with febrile UTI in Urology?'
		]
	},
	admin: {
		nav: 'Admin',
		loginTitle: 'Administrator sign-in',
		loginIntro: 'Only administrators can import laboratory files into AEI.',
		email: 'E-mail',
		password: 'Password',
		name: 'Name',
		signIn: 'Sign in',
		createTitle: 'Create an administrator account',
		createIntro: 'Only for addresses listed as administrators (ADMIN_EMAILS).',
		create: 'Create account',
		notAllowed: 'This address is not on the administrator list.',
		failed: 'Sign-in failed. Check the e-mail and password.',
		title: 'Data import',
		intro:
			'Add or correct laboratory results with CSV files. Columns are the same as in the dataset files; each file’s type is recognised from its header.',
		files: 'CSV files',
		filesHint: 'One or more files at a time.',
		check: 'Check',
		import: 'Import',
		templates: 'Templates',
		tables: {
			wards: 'Wards',
			antibiotics: 'Antibiotics',
			patients: 'Patients',
			cultures: 'Cultures',
			isolates: 'Isolates',
			susceptibility: 'Susceptibility results'
		},
		checked: 'Checked – nothing was saved.',
		imported: (n: string) => `${n} rows saved.`,
		rejected: (n: string) => `${n} rows rejected.`,
		colFile: 'File',
		colTable: 'Table',
		colRows: 'Rows',
		colValid: 'Valid',
		colUpdates: 'Updates',
		colErrors: 'Errors',
		line: 'line',
		unknownTable: 'unknown',
		history: 'Recent imports',
		noHistory: 'No import since the server started.',
		signedInAs: (e: string) => `Signed in as ${e}`,
		signOut: 'Sign out',
		order:
			'Files are processed wards → antibiotics → patients → cultures → isolates → susceptibility results, so a new culture can refer to a patient added in the same import. Existing rows are updated.',
		after: 'After an import every view and alert is recomputed at once.',
		dataNow: 'Data now',
		openStatus: 'Ingestion health'
	},
	station: {
		updated: 'Updated',
		calm: 'No material deviations in the last 4 weeks',
		resTitle: 'resistance rate',
		resLegend: 'bar: 12 mo · line and figure: 4 wk',
		footer:
			'Refreshes automatically. Decision support – does not replace local treatment guidelines.',
		avoid: (drugs: string) => `Avoid empirically for now: ${drugs}.`,
		pickWard: 'Ward'
	}
};

export const messages: Record<Locale, Messages> = { fi, en };

/** 47.8 → "47,8 %" (fi) / "47.8%" (en). */
export function formatPercent(locale: Locale, value: number | null, digits = 1): string {
	if (value === null || !Number.isFinite(value)) return '–';
	const s = value.toLocaleString(locale === 'fi' ? 'fi-FI' : 'en-GB', {
		maximumFractionDigits: digits,
		minimumFractionDigits: 0
	});
	return locale === 'fi' ? `${s} %` : `${s}%`;
}

export function formatNumber(locale: Locale, value: number): string {
	return value.toLocaleString(locale === 'fi' ? 'fi-FI' : 'en-GB');
}

/** ISO date → "30.6.2025" (fi) / "30 Jun 2025" (en). */
export function formatDate(locale: Locale, iso: string): string {
	const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
	if (locale === 'fi') return `${d}.${m}.${y}`;
	const month = [
		'Jan',
		'Feb',
		'Mar',
		'Apr',
		'May',
		'Jun',
		'Jul',
		'Aug',
		'Sep',
		'Oct',
		'Nov',
		'Dec'
	][m - 1];
	return `${d} ${month} ${y}`;
}

export function formatRange(locale: Locale, range: { from: string; to: string }): string {
	return `${formatDate(locale, range.from)} – ${formatDate(locale, range.to)}`;
}

/** Date and time of day, e.g. "17.10.2026 klo 10.32" / "17 Oct 2026, 10:32". */
export function formatDateTime(locale: Locale, date: Date): string {
	const pad = (n: number) => String(n).padStart(2, '0');
	const iso = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
	const hh = pad(date.getHours());
	const mm = pad(date.getMinutes());
	return locale === 'fi'
		? `${formatDate(locale, iso)} klo ${hh}.${mm}`
		: `${formatDate(locale, iso)}, ${hh}:${mm}`;
}
