// Statement of Facts event catalogue for LBH Curaçao port calls.
// Sourced from the agency's operational terminology research (115 events across
// 7 phases). Drives the SOF event log on the port-call dossier: quick-add
// buttons, phase grouping, and current-status derivation.

export type SofPhase =
  | 'pre_arrival'
  | 'anchorage_waiting'
  | 'berthing'
  | 'cargo_operations'
  | 'bunkering_services'
  | 'departure'
  | 'completion_closing';

export type SofType = 'milestone' | 'remark';
export type AppliesTo = 'cargo_agent' | 'owners_agent' | 'both';

export interface SofEventDef {
  key: string;
  label: string;
  phase: SofPhase;
  type: SofType;
  definition: string;
  // Which call type the event is relevant to, and whether a remark/reason is
  // mandatory when logging it (stoppages, protests, rejections, medical).
  appliesTo: AppliesTo;
  requiresReason: boolean;
}

export const SOF_PHASES: { key: SofPhase; label: string; short: string; tone: string }[] = [
  { key: 'pre_arrival', label: 'Pre-arrival / Approach', short: 'Pre-arrival', tone: 'text-sky-600' },
  { key: 'anchorage_waiting', label: 'Anchorage / Waiting', short: 'Anchorage', tone: 'text-indigo-600' },
  { key: 'berthing', label: 'Berthing', short: 'Berthing', tone: 'text-violet-600' },
  { key: 'cargo_operations', label: 'Cargo Operations', short: 'Cargo', tone: 'text-amber-600' },
  { key: 'bunkering_services', label: 'Bunkering & Services', short: 'Services', tone: 'text-teal-600' },
  { key: 'departure', label: 'Departure', short: 'Departure', tone: 'text-rose-600' },
  { key: 'completion_closing', label: 'Completion / Closing', short: 'Closing', tone: 'text-emerald-600' },
];

type RawSofEvent = Omit<SofEventDef, 'appliesTo' | 'requiresReason'>;

const RAW_EVENTS: RawSofEvent[] = [
  // 1. Pre-arrival / Approach
  { key: 'nomination_received', label: 'Nomination Received', phase: 'pre_arrival', type: 'milestone', definition: 'Agentschap wordt door de principaal aangesteld om het schip in de haven af te handelen.' },
  { key: 'appointment_confirmed', label: 'Agency Appointment Confirmed', phase: 'pre_arrival', type: 'milestone', definition: 'Bevestiging dat het agentschap formeel is benoemd als ship’s agent voor deze aanloop.' },
  { key: 'pda_issued', label: 'Proforma Disbursement Account (PDA) Issued', phase: 'pre_arrival', type: 'milestone', definition: 'Verzending van de geschatte kostenraming naar de principaal vóór aankomst.' },
  { key: 'prearrival_info_sent', label: 'Pre-arrival Information Sent', phase: 'pre_arrival', type: 'remark', definition: 'Agent stuurt port info, berthing prospects en vereiste formulieren naar het schip.' },
  { key: 'prearrival_docs_received', label: 'Pre-arrival Documents Received', phase: 'pre_arrival', type: 'milestone', definition: 'Ontvangst van pre-arrival forms, crew/cargo lijsten en certificaten van het schip.' },
  { key: 'eta_notice', label: 'ETA Notice Received', phase: 'pre_arrival', type: 'milestone', definition: 'Eerste opgave van de verwachte aankomsttijd (Estimated Time of Arrival).' },
  { key: 'eta_updated', label: 'ETA Updated', phase: 'pre_arrival', type: 'remark', definition: 'Bijgewerkte verwachte aankomsttijd (bv. 72/48/24 uur notices).' },
  { key: 'port_authority_notified', label: 'Port Authority / Harbour Master Notified', phase: 'pre_arrival', type: 'milestone', definition: 'Aanmelding van het schip bij de havenmeester / havenautoriteit.' },
  { key: 'vessel_passed_reporting_point', label: 'Vessel Passed Reporting Point', phase: 'pre_arrival', type: 'remark', definition: 'Schip passeert een vastgesteld meldpunt op de approach.' },
  { key: 'vessel_in_vts', label: 'Vessel Reported to VTS', phase: 'pre_arrival', type: 'milestone', definition: 'Schip meldt zich aan bij Vessel Traffic Service van de haven.' },
  { key: 'eosp', label: 'End of Sea Passage (EOSP)', phase: 'pre_arrival', type: 'milestone', definition: 'Einde van de zeereis; navigatie schakelt over naar haven-/manoeuvreermodus.' },
  { key: 'arrived_pilot_station', label: 'Arrived at Pilot Station', phase: 'pre_arrival', type: 'milestone', definition: 'Schip bereikt het loodsstation / het opstappunt voor de loods.' },
  { key: 'pilot_ordered', label: 'Pilot Ordered / Booked', phase: 'pre_arrival', type: 'milestone', definition: 'Loods wordt aangevraagd bij de loodsdienst voor binnenkomst.' },
  { key: 'immigration_clearance', label: 'Immigration Clearance', phase: 'pre_arrival', type: 'milestone', definition: 'Immigratie keurt bemanning/passagiers goed voor binnenkomst.' },
  { key: 'customs_clearance', label: 'Customs Clearance', phase: 'pre_arrival', type: 'milestone', definition: 'Douaneklaring van schip en lading bij binnenkomst (inward clearance).' },
  { key: 'free_pratique_granted', label: 'Free Pratique Granted', phase: 'pre_arrival', type: 'milestone', definition: 'Gezondheidsklaring; schip mag contact maken met de wal (geen quarantaine).' },
  { key: 'inward_clearance', label: 'Inward Clearance Completed', phase: 'pre_arrival', type: 'milestone', definition: 'Alle binnenkomstformaliteiten (douane/immigratie/health) zijn afgerond.' },

  // 2. Anchorage / Waiting
  { key: 'anchored', label: 'Anchored / Dropped Anchor', phase: 'anchorage_waiting', type: 'milestone', definition: 'Schip gaat ten anker op de aangewezen ankerplaats.' },
  { key: 'anchor_position_logged', label: 'Anchor Position Logged', phase: 'anchorage_waiting', type: 'remark', definition: 'Vastleggen van de exacte ankerpositie (lat/long).' },
  { key: 'nor_tendered', label: 'Notice of Readiness (NOR) Tendered', phase: 'anchorage_waiting', type: 'milestone', definition: 'Schip verklaart gereed te zijn om te laden/lossen; start mogelijke laytime.' },
  { key: 'nor_accepted', label: 'Notice of Readiness (NOR) Accepted', phase: 'anchorage_waiting', type: 'milestone', definition: 'Ontvanger/charteraar aanvaardt de NOR formeel.' },
  { key: 'nor_rejected', label: 'Notice of Readiness (NOR) Rejected', phase: 'anchorage_waiting', type: 'remark', definition: 'NOR wordt afgewezen (bv. schip niet gereed of buiten kantooruren).' },
  { key: 'laytime_commenced', label: 'Laytime Commenced', phase: 'anchorage_waiting', type: 'milestone', definition: 'Start van de overeengekomen laad-/lostijd volgens charter party.' },
  { key: 'awaiting_berth', label: 'Awaiting Berth', phase: 'anchorage_waiting', type: 'remark', definition: 'Schip wacht op een vrije ligplaats (congestion / bezetting).' },
  { key: 'awaiting_orders', label: 'Awaiting Orders', phase: 'anchorage_waiting', type: 'remark', definition: 'Schip wacht op instructies van principaal/charteraar.' },
  { key: 'awaiting_tide', label: 'Awaiting Tide', phase: 'anchorage_waiting', type: 'remark', definition: 'Wachten op gunstig getij i.v.m. diepgang/draft restricties.' },
  { key: 'awaiting_daylight', label: 'Awaiting Daylight', phase: 'anchorage_waiting', type: 'remark', definition: 'Wachten op daglicht omdat manoeuvres alleen overdag zijn toegestaan.' },
  { key: 'awaiting_pilot', label: 'Awaiting Pilot', phase: 'anchorage_waiting', type: 'remark', definition: 'Wachten op beschikbaarheid van de loods.' },
  { key: 'awaiting_documents', label: 'Awaiting Documents', phase: 'anchorage_waiting', type: 'remark', definition: 'Wachten op vereiste papieren (bv. cargo docs, klaring).' },
  { key: 'awaiting_free_pratique', label: 'Awaiting Free Pratique', phase: 'anchorage_waiting', type: 'remark', definition: 'Wachten op gezondheidsklaring voordat wal-contact is toegestaan.' },
  { key: 'awaiting_weather', label: 'Awaiting Weather / Weather Delay', phase: 'anchorage_waiting', type: 'remark', definition: 'Oponthoud door slecht weer, wind of zwell.' },
  { key: 'anchor_aweigh', label: 'Anchor Aweigh / Heaved Up Anchor', phase: 'anchorage_waiting', type: 'milestone', definition: 'Anker wordt gelicht; schip maakt zich klaar om naar de ligplaats te varen.' },

  // 3. Berthing
  { key: 'pilot_on_board_arrival', label: 'Pilot on Board (POB) — Arrival', phase: 'berthing', type: 'milestone', definition: 'Loods is aan boord voor de binnenkomstmanoeuvre.' },
  { key: 'tugs_made_fast', label: 'Tugs Made Fast', phase: 'berthing', type: 'remark', definition: 'Sleepboten zijn vastgemaakt voor assistentie bij het afmeren.' },
  { key: 'vessel_underway_to_berth', label: 'Vessel Underway to Berth', phase: 'berthing', type: 'milestone', definition: 'Schip vaart vanaf anker/loodsstation richting de ligplaats.' },
  { key: 'arrived_at_berth', label: 'Arrived at Berth', phase: 'berthing', type: 'milestone', definition: 'Schip bereikt de toegewezen ligplaats.' },
  { key: 'first_line_ashore', label: 'First Line Ashore', phase: 'berthing', type: 'milestone', definition: 'Eerste meertros gaat aan wal; begin van het afmeren.' },
  { key: 'all_fast', label: 'All Fast / Made Fast', phase: 'berthing', type: 'milestone', definition: 'Alle trossen vast; schip ligt veilig afgemeerd.' },
  { key: 'atb', label: 'Actual Time of Berthing (ATB)', phase: 'berthing', type: 'milestone', definition: 'Werkelijke tijd waarop het schip volledig is afgemeerd.' },
  { key: 'gangway_down', label: 'Gangway Down / Lowered', phase: 'berthing', type: 'milestone', definition: 'Loopplank is neergelaten; veilige toegang tot/van de wal.' },
  { key: 'tugs_cast_off', label: 'Tugs Cast Off', phase: 'berthing', type: 'remark', definition: 'Sleepboten worden losgegooid na het afmeren.' },
  { key: 'pilot_disembarked_arrival', label: 'Pilot Disembarked — After Berthing', phase: 'berthing', type: 'milestone', definition: 'Loods verlaat het schip na voltooid afmeren.' },
  { key: 'shifting_berth_commenced', label: 'Shifting Berth Commenced', phase: 'berthing', type: 'remark', definition: 'Begin van het verhalen naar een andere ligplaats.' },
  { key: 'shifting_berth_completed', label: 'Shifting Berth Completed', phase: 'berthing', type: 'remark', definition: 'Schip is afgemeerd op de nieuwe ligplaats na verhalen.' },

  // 4. Cargo Operations
  { key: 'documents_on_board', label: 'Documents on Board', phase: 'cargo_operations', type: 'milestone', definition: 'Cargo-/scheepsdocumenten zijn aan boord aangeleverd.' },
  { key: 'surveyor_on_board', label: 'Surveyor(s) on Board', phase: 'cargo_operations', type: 'milestone', definition: 'Cargo-/draft surveyor(s) komen aan boord voor inspectie.' },
  { key: 'initial_draft_survey', label: 'Initial Draft Survey', phase: 'cargo_operations', type: 'milestone', definition: 'Eerste diepgangmeting om beginhoeveelheid lading te bepalen.' },
  { key: 'initial_ullage_survey', label: 'Initial Ullage / Gauging Survey', phase: 'cargo_operations', type: 'milestone', definition: 'Beginmeting van tankniveaus (ullage) bij vloeibare bulk.' },
  { key: 'tank_inspection', label: 'Tank / Hold Inspection', phase: 'cargo_operations', type: 'milestone', definition: 'Inspectie van tanks/ruimen op geschiktheid en reinheid.' },
  { key: 'sampling', label: 'Cargo Sampling', phase: 'cargo_operations', type: 'remark', definition: 'Nemen van ladingmonsters voor kwaliteitsanalyse.' },
  { key: 'hoses_connected', label: 'Hoses / Loading Arms Connected', phase: 'cargo_operations', type: 'milestone', definition: 'Slangen/laadarmen zijn aangesloten voor vloeibare bulk.' },
  { key: 'cargo_commenced_loading', label: 'Commenced Loading', phase: 'cargo_operations', type: 'milestone', definition: 'Start van het laden van de lading.' },
  { key: 'cargo_commenced_discharging', label: 'Commenced Discharging', phase: 'cargo_operations', type: 'milestone', definition: 'Start van het lossen van de lading.' },
  { key: 'cargo_stopped', label: 'Cargo Operations Stopped', phase: 'cargo_operations', type: 'remark', definition: 'Laden/lossen tijdelijk gestopt (reden vereist in remark).' },
  { key: 'cargo_resumed', label: 'Cargo Operations Resumed', phase: 'cargo_operations', type: 'remark', definition: 'Laden/lossen hervat na een onderbreking.' },
  { key: 'stoppage_rain', label: 'Stoppage — Rain', phase: 'cargo_operations', type: 'remark', definition: 'Oponthoud door regen (relevant bij hygroscopische/droge bulk).' },
  { key: 'stoppage_equipment_failure', label: 'Stoppage — Equipment Failure', phase: 'cargo_operations', type: 'remark', definition: 'Oponthoud door defect aan ship’s gear of terminal-apparatuur.' },
  { key: 'stoppage_shore_tank', label: 'Stoppage — Shore Tank / Terminal', phase: 'cargo_operations', type: 'remark', definition: 'Oponthoud aan walzijde (tankwissel, lijndruk, terminalvertraging).' },
  { key: 'stoppage_vessel_reasons', label: 'Stoppage — Vessel Reasons', phase: 'cargo_operations', type: 'remark', definition: 'Oponthoud door scheepszijde (ballast, deballasten, tankwissel, pomp).' },
  { key: 'stoppage_awaiting_documents', label: 'Stoppage — Awaiting Cargo Documents', phase: 'cargo_operations', type: 'remark', definition: 'Oponthoud in afwachting van cargo-papieren/instructies.' },
  { key: 'ballast_operations', label: 'Ballast / Deballast Operations', phase: 'cargo_operations', type: 'remark', definition: 'Ballastwater wordt ingenomen of geloosd parallel aan de lading.' },
  { key: 'draft_survey_intermediate', label: 'Intermediate Draft Survey', phase: 'cargo_operations', type: 'remark', definition: 'Tussentijdse diepgangmeting tijdens de operatie.' },
  { key: 'cargo_completed_loading', label: 'Completed Loading', phase: 'cargo_operations', type: 'milestone', definition: 'Laden van de volledige lading is voltooid.' },
  { key: 'cargo_completed_discharging', label: 'Completed Discharging', phase: 'cargo_operations', type: 'milestone', definition: 'Lossen van de volledige lading is voltooid.' },
  { key: 'hoses_disconnected', label: 'Hoses / Loading Arms Disconnected', phase: 'cargo_operations', type: 'milestone', definition: 'Slangen/laadarmen worden losgekoppeld na de operatie.' },
  { key: 'final_draft_survey', label: 'Final Draft Survey', phase: 'cargo_operations', type: 'milestone', definition: 'Eindmeting diepgang om de totale geladen/geloste hoeveelheid te bevestigen.' },
  { key: 'final_ullage_survey', label: 'Final Ullage / Gauging Survey', phase: 'cargo_operations', type: 'milestone', definition: 'Eindmeting van tankniveaus bij vloeibare bulk.' },
  { key: 'dry_certificate', label: 'Dry / Empty Tank Certificate Issued', phase: 'cargo_operations', type: 'remark', definition: 'Verklaring dat tanks/ruimen leeg en droog zijn na lossen.' },
  { key: 'hold_tank_cleaning', label: 'Hold / Tank Cleaning', phase: 'cargo_operations', type: 'remark', definition: 'Reiniging van ruimen/tanks tussen ladingen.' },
  { key: 'cargo_calculation_agreed', label: 'Cargo Figures Agreed', phase: 'cargo_operations', type: 'milestone', definition: 'Definitieve ladinghoeveelheid wordt door betrokken partijen geaccordeerd.' },
  { key: 'bl_figures_issued', label: 'Bill of Lading Figures Issued', phase: 'cargo_operations', type: 'milestone', definition: 'Cijfers voor de cognossementen (B/L) worden vastgesteld.' },

  // 5. Bunkering & Services
  { key: 'bunker_barge_alongside', label: 'Bunker Barge Alongside', phase: 'bunkering_services', type: 'milestone', definition: 'Bunkerbarge meert af langszij voor brandstoflevering.' },
  { key: 'bunkering_commenced', label: 'Commenced Bunkering', phase: 'bunkering_services', type: 'milestone', definition: 'Start van het bunkeren (HFO/MGO/LSFO of smeermiddelen).' },
  { key: 'bunkering_stopped', label: 'Bunkering Stopped / Suspended', phase: 'bunkering_services', type: 'remark', definition: 'Bunkeren tijdelijk gestopt.' },
  { key: 'bunkering_completed', label: 'Completed Bunkering', phase: 'bunkering_services', type: 'milestone', definition: 'Bunkeren voltooid.' },
  { key: 'bdn_signed', label: 'Bunker Delivery Note (BDN) Signed', phase: 'bunkering_services', type: 'milestone', definition: 'Ondertekening van de bunkerbon met geleverde hoeveelheden.' },
  { key: 'bunker_barge_cast_off', label: 'Bunker Barge Cast Off', phase: 'bunkering_services', type: 'remark', definition: 'Bunkerbarge vertrekt na voltooide levering.' },
  { key: 'sludge_disposal', label: 'Sludge / Slops Disposal', phase: 'bunkering_services', type: 'milestone', definition: 'Afvoer van sludge/slops naar ontvangstinstallatie of barge.' },
  { key: 'garbage_removal', label: 'Garbage Removal', phase: 'bunkering_services', type: 'milestone', definition: 'Afvoer van scheepsafval conform MARPOL Annex V.' },
  { key: 'fresh_water_supply', label: 'Fresh Water (FW) Supply', phase: 'bunkering_services', type: 'milestone', definition: 'Levering van drinkwater/zoetwater aan het schip.' },
  { key: 'provisions_stores_delivery', label: 'Provisions / Stores Delivery', phase: 'bunkering_services', type: 'milestone', definition: 'Levering van proviand en scheepsbenodigdheden (stores).' },
  { key: 'spares_delivery', label: 'Spare Parts Delivery', phase: 'bunkering_services', type: 'milestone', definition: 'Aflevering van reserveonderdelen aan boord.' },
  { key: 'spares_landed', label: 'Spare Parts / Equipment Landed', phase: 'bunkering_services', type: 'remark', definition: 'Onderdelen/uitrusting worden van boord aan wal gebracht.' },
  { key: 'crew_change_on', label: 'Crew Sign On / Embarkation', phase: 'bunkering_services', type: 'milestone', definition: 'Nieuwe bemanning komt aan boord.' },
  { key: 'crew_change_off', label: 'Crew Sign Off / Disembarkation', phase: 'bunkering_services', type: 'milestone', definition: 'Afgeloste bemanning verlaat het schip.' },
  { key: 'cash_to_master', label: 'Cash to Master (CTM)', phase: 'bunkering_services', type: 'milestone', definition: 'Contant geld wordt aan de kapitein geleverd voor scheepsuitgaven.' },
  { key: 'technicians_on_board', label: 'Technicians / Superintendent on Board', phase: 'bunkering_services', type: 'milestone', definition: 'Technici, klasse-surveyor of superintendent komen aan boord.' },
  { key: 'medical_attendance', label: 'Medical Attendance / Doctor on Board', phase: 'bunkering_services', type: 'remark', definition: 'Medische hulp of arts aan boord voor bemanningslid.' },
  { key: 'crew_hospitalized', label: 'Crew Member Hospitalized / Landed', phase: 'bunkering_services', type: 'remark', definition: 'Bemanningslid wordt voor medische redenen aan wal gebracht.' },
  { key: 'repairs_on_board', label: 'Repairs / Maintenance on Board', phase: 'bunkering_services', type: 'remark', definition: 'Reparaties of onderhoud worden uitgevoerd tijdens de aanloop.' },
  { key: 'class_survey', label: 'Class / Statutory Survey', phase: 'bunkering_services', type: 'remark', definition: 'Klasse- of wettelijke survey aan boord (bv. flag/PSC-gerelateerd).' },
  { key: 'psc_inspection', label: 'Port State Control (PSC) Inspection', phase: 'bunkering_services', type: 'remark', definition: 'Inspectie door Port State Control.' },
  { key: 'hold_water_wash', label: 'Fresh Water Wash / Hold Inspection Service', phase: 'bunkering_services', type: 'remark', definition: 'Walservice voor ruim-/dekreiniging waar van toepassing.' },

  // 6. Departure
  { key: 'cargo_docs_signed', label: 'Cargo Documents Signed', phase: 'departure', type: 'milestone', definition: 'Cognossementen/manifest en overige ladingpapieren ondertekend.' },
  { key: 'documents_dispatched', label: 'Documents Dispatched / Couriered', phase: 'departure', type: 'remark', definition: 'Originele documenten worden verzonden naar betrokken partijen.' },
  { key: 'outward_clearance', label: 'Outward / Port Clearance Granted', phase: 'departure', type: 'milestone', definition: 'Haven-/douaneklaring voor vertrek (port clearance) verkregen.' },
  { key: 'pilot_ordered_departure', label: 'Pilot Ordered — Departure', phase: 'departure', type: 'milestone', definition: 'Loods aangevraagd voor de vertrekmanoeuvre.' },
  { key: 'pilot_on_board_departure', label: 'Pilot on Board (POB) — Departure', phase: 'departure', type: 'milestone', definition: 'Loods aan boord voor het ontmeren en uitvaren.' },
  { key: 'tugs_made_fast_departure', label: 'Tugs Made Fast — Departure', phase: 'departure', type: 'remark', definition: 'Sleepboten vastgemaakt voor de vertrekmanoeuvre.' },
  { key: 'gangway_up', label: 'Gangway Up / Raised', phase: 'departure', type: 'milestone', definition: 'Loopplank wordt ingenomen ter voorbereiding op vertrek.' },
  { key: 'single_up', label: 'Single Up', phase: 'departure', type: 'remark', definition: 'Terugbrengen naar enkele trossen vlak voor losgooien.' },
  { key: 'last_line_let_go', label: 'Last Line / Let Go', phase: 'departure', type: 'milestone', definition: 'Laatste tros wordt losgegooid; schip komt los van de kade.' },
  { key: 'vessel_unberthed', label: 'Vessel Unberthed / Off Berth', phase: 'departure', type: 'milestone', definition: 'Schip is losgemaakt en weg van de ligplaats.' },
  { key: 'atd', label: 'Actual Time of Departure (ATD)', phase: 'departure', type: 'milestone', definition: 'Werkelijke vertrektijd van het schip uit de haven/ligplaats.' },
  { key: 'tugs_cast_off_departure', label: 'Tugs Cast Off — Departure', phase: 'departure', type: 'remark', definition: 'Sleepboten losgegooid nadat het schip vrij vaarwater heeft.' },
  { key: 'pilot_disembarked_departure', label: 'Pilot Disembarked — Departure', phase: 'departure', type: 'milestone', definition: 'Loods verlaat het schip bij het loodsstation na uitvaren.' },
  { key: 'cosp', label: 'Commencement of Sea Passage (COSP)', phase: 'departure', type: 'milestone', definition: 'Begin van de zeereis; schip schakelt over naar zeevaartmodus.' },
  { key: 'vessel_cleared_port', label: 'Vessel Cleared Port Limits', phase: 'departure', type: 'milestone', definition: 'Schip passeert de havengrenzen en is vertrokken.' },

  // 7. Completion / Closing
  { key: 'operation_completed', label: 'Port Operation Completed', phase: 'completion_closing', type: 'milestone', definition: 'Alle cargo- en husbandry-werkzaamheden zijn afgerond.' },
  { key: 'sof_signed', label: 'Statement of Facts (SOF) Signed', phase: 'completion_closing', type: 'milestone', definition: 'SOF wordt door kapitein/agent/terminal ondertekend.' },
  { key: 'timesheet_prepared', label: 'Time Sheet Prepared', phase: 'completion_closing', type: 'milestone', definition: 'Laytime/time sheet opgesteld op basis van de SOF-tijden.' },
  { key: 'lop_issued', label: 'Letter of Protest (LOP) Issued/Received', phase: 'completion_closing', type: 'remark', definition: 'Formeel protest over bv. tijden, hoeveelheden of vertragingen.' },
  { key: 'fda_prepared', label: 'Final Disbursement Account (FDA) Prepared', phase: 'completion_closing', type: 'milestone', definition: 'Eindafrekening van alle havenkosten opgesteld.' },
  { key: 'da_submitted', label: 'Disbursement Account Submitted to Principal', phase: 'completion_closing', type: 'milestone', definition: 'FDA met onderliggende facturen ingediend bij de principaal.' },
  { key: 'port_call_closed', label: 'Port Call / Statement Closed', phase: 'completion_closing', type: 'milestone', definition: 'Aanloop administratief afgesloten in het systeem.' },
];

// Events specific to a cargo call even though they fall outside the cargo phase.
const CARGO_ONLY_KEYS = new Set([
  'nor_tendered',
  'nor_accepted',
  'nor_rejected',
  'laytime_commenced',
  'cargo_docs_signed',
  'documents_dispatched',
]);

// Events that must carry a reason/remark when logged (delays, protests, etc.).
const REQUIRES_REASON_KEYS = new Set([
  'nor_rejected',
  'awaiting_weather',
  'shifting_berth_commenced',
  'cargo_stopped',
  'cargo_resumed',
  'stoppage_rain',
  'stoppage_equipment_failure',
  'stoppage_shore_tank',
  'stoppage_vessel_reasons',
  'stoppage_awaiting_documents',
  'bunkering_stopped',
  'medical_attendance',
  'crew_hospitalized',
  'repairs_on_board',
  'lop_issued',
]);

function appliesToOf(e: RawSofEvent): AppliesTo {
  if (e.phase === 'cargo_operations') return 'cargo_agent';
  if (e.phase === 'bunkering_services') return 'owners_agent';
  if (CARGO_ONLY_KEYS.has(e.key)) return 'cargo_agent';
  return 'both';
}

// The canonical catalogue, enriched with applicability + reason flags. Array
// order is the canonical SOF order (pre-arrival → closing).
export const SOF_EVENTS: SofEventDef[] = RAW_EVENTS.map((e) => ({
  ...e,
  appliesTo: appliesToOf(e),
  requiresReason: REQUIRES_REASON_KEYS.has(e.key),
}));

export const SOF_BY_KEY: Record<string, SofEventDef> = Object.fromEntries(
  SOF_EVENTS.map((e) => [e.key, e]),
);

/** Is an event relevant to a given call type? `null` callType = show all. */
export function eventApplies(def: SofEventDef, callType: AppliesTo | null): boolean {
  if (!callType || callType === 'both') return true;
  return def.appliesTo === 'both' || def.appliesTo === callType;
}

export function eventLabel(key: string): string {
  return SOF_BY_KEY[key]?.label ?? key;
}

export interface OpsStatus {
  label: string;
  tone: 'slate' | 'sky' | 'indigo' | 'violet' | 'amber' | 'teal' | 'rose' | 'emerald';
}

// Map the most recent logged event to a current operational status.
const STATUS_BY_KEY: Record<string, OpsStatus> = {
  nomination_received: { label: 'Nominated', tone: 'sky' },
  appointment_confirmed: { label: 'Nominated', tone: 'sky' },
  anchored: { label: 'At anchor', tone: 'indigo' },
  nor_tendered: { label: 'NOR tendered', tone: 'indigo' },
  anchor_aweigh: { label: 'Proceeding in', tone: 'violet' },
  pilot_on_board_arrival: { label: 'Inbound', tone: 'violet' },
  all_fast: { label: 'Alongside', tone: 'violet' },
  atb: { label: 'Alongside', tone: 'violet' },
  arrived_at_berth: { label: 'Alongside', tone: 'violet' },
  first_line_ashore: { label: 'Berthing', tone: 'violet' },
  cargo_commenced_loading: { label: 'Loading', tone: 'amber' },
  cargo_commenced_discharging: { label: 'Discharging', tone: 'amber' },
  cargo_completed_loading: { label: 'Cargo complete', tone: 'amber' },
  cargo_completed_discharging: { label: 'Cargo complete', tone: 'amber' },
  bunkering_commenced: { label: 'Bunkering', tone: 'teal' },
  bunkering_completed: { label: 'Bunkers done', tone: 'teal' },
  last_line_let_go: { label: 'Departing', tone: 'rose' },
  vessel_unberthed: { label: 'Departing', tone: 'rose' },
  atd: { label: 'Sailed', tone: 'rose' },
  cosp: { label: 'Sailed', tone: 'rose' },
  vessel_cleared_port: { label: 'Sailed', tone: 'rose' },
  operation_completed: { label: 'Completed', tone: 'emerald' },
  port_call_closed: { label: 'Closed', tone: 'emerald' },
};

const PHASE_STATUS: Record<SofPhase, OpsStatus> = {
  pre_arrival: { label: 'Expected', tone: 'sky' },
  anchorage_waiting: { label: 'At anchor', tone: 'indigo' },
  berthing: { label: 'Alongside', tone: 'violet' },
  cargo_operations: { label: 'Cargo ops', tone: 'amber' },
  bunkering_services: { label: 'In service', tone: 'teal' },
  departure: { label: 'Departing', tone: 'rose' },
  completion_closing: { label: 'Completed', tone: 'emerald' },
};

/** Derive the current operational status from the latest logged event. */
export function deriveOpsStatus(events: { event_type: string; event_time: string }[]): OpsStatus {
  if (!events.length) return { label: 'Expected', tone: 'slate' };
  const latest = [...events].sort((a, b) => b.event_time.localeCompare(a.event_time))[0];
  return STATUS_BY_KEY[latest.event_type] ?? PHASE_STATUS[SOF_BY_KEY[latest.event_type]?.phase ?? 'pre_arrival'];
}
