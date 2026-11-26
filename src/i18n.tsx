import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Assessment, CropWarning, PlanStage, Prediction } from './types';
import { getStoredLanguage, storeLanguage, type Language } from './lib/prefs';

type Vars = Record<string, string | number>;

const am: Record<string, string> = {
  Dashboard: 'ዳሽቦርድ',
  'My crops': 'ሰብሎቼ',
  'Add crop': 'ሰብል ጨምር',
  'AI photo scan': 'የAI ፎቶ ቅኝት',
  Workspace: 'የሥራ ቦታ',
  'Farm overview': 'የእርሻ አጠቃላይ እይታ',
  'What the model sees across your fields today.': 'ሞዴሉ ዛሬ በሜዳዎችዎ ላይ የሚያየው።',
  'Every field, its stage and its latest prediction.': 'እያንዳንዱ ሜዳ፣ ደረጃው እና የቅርብ ጊዜ ትንበያው።',
  'Register what you planted and get a care plan.': 'የተከሉትን ይመዝግቡ እና የእንክብካቤ እቅድ ያግኙ።',
  'Take or upload a photo and let the agronomist look.': 'ፎቶ ያንሱ ወይም ይጫኑ እና የግብርና ባለሙያው ይመልከተው።',
  'Pre-prediction farming': 'ቅድመ-ትንበያ እርሻ',
  'Gemini connected': 'Gemini ተገናኝቷል',
  'Photo diagnosis is live': 'የፎቶ ምርመራ እየሠራ ነው',
  'Local rules active': 'የአካባቢ ደንቦች ንቁ ናቸው',
  'Add an API key for photo AI': 'ለፎቶ AI የAPI ቁልፍ ያክሉ',
  'Sign out': 'ውጣ',
  'Open menu': 'ምናሌ ክፈት',
  'Close menu': 'ምናሌ ዝጋ',
  'AI live': 'AI ንቁ',
  'Local mode': 'የአካባቢ ሁነታ',
  'Hello,': 'ሰላም፣',
  Farmer: 'ገበሬ',
  Language: 'ቋንቋ',
  'Built for the field': 'ለሜዳ የተሠራ',
  'Know your crop is in trouble before you can see it.': 'ሰብልዎ ችግር ላይ መሆኑን ከማየትዎ በፊት ይወቁ።',
  'Log what you did today. MasAI compares it with the care plan, watches for missing records, and warns you while there is still time to act.':
    'ዛሬ የሠሩትን ይመዝግቡ። MasAI ከእንክብካቤ እቅዱ ጋር ያወዳድራል፣ የጎደሉ መዝገቦችን ይከታተላል፣ እና እርምጃ ለመውሰድ ጊዜ ሳይወጣ ያስጠነቅቅዎታል።',
  'Daily care plan for every crop': 'ለእያንዳንዱ ሰብል ዕለታዊ የእንክብካቤ እቅድ',
  'Water and damage prediction': 'የውሃ እና ጉዳት ትንበያ',
  'Photo diagnosis that updates the report': 'ሪፖርቱን የሚያዘምን የፎቶ ምርመራ',
  'Records are stored locally in SQLite on this device.': 'መዝገቦች በዚህ መሣሪያ ላይ በSQLite በአካባቢው ይቀመጣሉ።',
  'Welcome to MasAI': 'እንኳን ወደ MasAI መጡ',
  'Sign in to your farm': 'ወደ እርሻዎ ይግቡ',
  'Create your farm': 'እርሻዎን ይፍጠሩ',
  'Use your phone number and PIN to continue.': 'ለመቀጠል ስልክ ቁጥርዎን እና PINዎን ይጠቀሙ።',
  'A 4 to 8 digit PIN keeps your records private.': 'ከ4 እስከ 8 አሃዝ PIN መዝገቦችዎን ሚስጥራዊ ያደርጋል።',
  'Sign in': 'ግባ',
  Register: 'ተመዝገብ',
  'Full name': 'ሙሉ ስም',
  'Phone number': 'ስልክ ቁጥር',
  PIN: 'PIN',
  Region: 'ክልል',
  optional: 'አማራጭ',
  'e.g. Abebe Tola': 'ለምሳሌ አበበ ቶላ',
  'e.g. 0912345678': 'ለምሳሌ 0912345678',
  '4–8 digits': '4–8 አሃዞች',
  'e.g. Oromia': 'ለምሳሌ ኦሮሚያ',
  'Could not sign in. Try again.': 'መግባት አልተቻለም። እንደገና ይሞክሩ።',
  'Could not open the demo farm.': 'የማሳያ እርሻውን መክፈት አልተቻለም።',
  'Create account': 'መለያ ፍጠር',
  'or explore first': 'ወይም መጀመሪያ ይመልከቱ',
  'Open the demo farm': 'የማሳያ እርሻውን ክፈት',
  'Includes {crops} with real records and warnings.': '{crops} ን ከእውነተኛ መዝገቦች እና ማስጠንቀቂያዎች ጋር ያካትታል።',
  'Loading…': 'በመጫን ላይ…',
  'Something needs attention': 'የሆነ ነገር ትኩረት ይፈልጋል',
  health: 'ጤና',
  damage: 'ጉዳት',
  'health trend': 'የጤና አዝማሚያ',
  'More records will draw a trend.': 'ተጨማሪ መዝገቦች አዝማሚያውን ይሳላሉ።',
  'Report changes': 'የሪፖርት ለውጦች',
  'What was seen': 'የታየው',
  'What to do': 'ምን ማድረግ አለብዎ',
  'Possible causes': 'ሊሆኑ የሚችሉ ምክንያቶች',
  '{n}% sure': '{n}% እርግጠኛ',
  'Reading your fields…': 'ሜዳዎችዎን በማንበብ ላይ…',
  'Could not load your farm.': 'እርሻዎን መጫን አልተቻለም።',
  'Good to see you, {name}.': 'እንኳን ደህና መጡ፣ {name}።',
  'Here is what the model predicts for your farm today.': 'ሞዴሉ ዛሬ ለእርሻዎ የሚተነብየው ይኸው ነው።',
  'New crop': 'አዲስ ሰብል',
  'Active crops': 'ንቁ ሰብሎች',
  '{n} total': 'ጠቅላላ {n}',
  'Average health': 'አማካይ ጤና',
  '{n} need attention': '{n} ትኩረት ይፈልጋሉ',
  'Records due today': 'ዛሬ የሚጠበቁ መዝገቦች',
  '{n} logged this week': 'በዚህ ሳምንት {n} ተመዝግቧል',
  'Highest damage': 'ከፍተኛው ጉዳት',
  '{n} critical alerts': '{n} ወሳኝ ማስጠንቀቂያዎች',
  'Early warnings': 'ቅድመ ማስጠንቀቂያዎች',
  'Ranked by how urgently they need your attention.': 'በአስቸኳይነታቸው ተራ ተደርገዋል።',
  '{n} alerts': '{n} ማስጠንቀቂያዎች',
  'No warnings right now': 'አሁን ማስጠንቀቂያ የለም',
  'Your records look consistent. Keep logging daily so the model stays honest.': 'መዝገቦችዎ ወጥ ይመስላሉ። ሞዴሉ ትክክለኛ እንዲሆን በየቀኑ መመዝገብዎን ይቀጥሉ።',
  'Due today': 'ዛሬ የሚጠበቅ',
  'Missing records lower predicted health.': 'የጎደሉ መዝገቦች የተተነበየውን ጤና ይቀንሳሉ።',
  '{n} pending': '{n} በመጠበቅ ላይ',
  'Log record': 'መዝገብ አስገባ',
  'All caught up': 'ሁሉም ተጠናቋል',
  'Every active crop has a record for today.': 'እያንዳንዱ ንቁ ሰብል የዛሬ መዝገብ አለው።',
  'Your crops': 'ሰብሎችዎ',
  'Prediction health blends the last AI verdict with your record consistency.': 'የትንበያ ጤና የመጨረሻውን የAI ፍርድ ከመዝገብ ቅንጅትዎ ጋር ያጣምራል።',
  'View all': 'ሁሉንም ይመልከቱ',
  'Day {day} of {total}': 'ቀን {day} ከ{total}',
  harvest: 'መከር',
  'Record due': 'መዝገብ ይጠበቃል',
  'Logged today': 'ዛሬ ተመዝግቧል',
  'No AI baseline': 'የAI መነሻ የለም',
  'Open report': 'ሪፖርት ክፈት',
  'Your farm is ready for its first crop': 'እርሻዎ ለመጀመሪያ ሰብሉ ዝግ ነው',
  'Add what you planted and MasAI will build a care plan and start the prediction.': 'የተከሉትን ያክሉ፤ MasAI የእንክብካቤ እቅድ ገንብቶ ትንበያውን ይጀምራል።',
  'Add a crop': 'ሰብል ጨምር',
  'Open demo farm': 'የማሳያ እርሻ ክፈት',
  'Unnamed field': 'ስም የሌለው ሜዳ',
  Growing: 'በእድገት ላይ',
  'Loading crops…': 'ሰብሎችን በመጫን ላይ…',
  'Could not load crops.': 'ሰብሎችን መጫን አልተቻለም።',
  'Delete this crop and all of its records?': 'ይህን ሰብል እና ሁሉንም መዝገቦቹን ይሰርዙ?',
  'Could not delete this crop.': 'ይህን ሰብል መሰረዝ አልተቻለም።',
  'Search crop, variety or field': 'ሰብል፣ ዝርያ ወይም ሜዳ ይፈልጉ',
  All: 'ሁሉም',
  Active: 'ንቁ',
  Harvested: 'ተሰብስቧል',
  Failed: 'አልተሳካም',
  '{severity} priority': '{severity} ቅድሚያ',
  'Day {day}/{total}': 'ቀን {day}/{total}',
  '{n} L today': 'ዛሬ {n} ሊ',
  '{n}% logged': '{n}% ተመዝግቧል',
  'no scan': 'ቅኝት የለም',
  Report: 'ሪፖርት',
  'Log today': 'ዛሬን መዝግብ',
  'Delete crop': 'ሰብል ሰርዝ',
  'No crops match that search': 'ከዚህ ፍለጋ ጋር የሚዛመድ ሰብል የለም',
  'No crops yet': 'እስካሁን ሰብል የለም',
  'Try another search or change the filter.': 'ሌላ ፍለጋ ይሞክሩ ወይም ማጣሪያውን ይቀይሩ።',
  'Register a crop to start your prediction.': 'ትንበያዎን ለመጀመር ሰብል ይመዝግቡ።',
  'Opening crop report…': 'የሰብል ሪፖርት በመክፈት ላይ…',
  'Could not load this crop.': 'ይህን ሰብል መጫን አልተቻለም።',
  'Could not rebuild the plan.': 'እቅዱን እንደገና መገንባት አልተቻለም።',
  'Could not update the status.': 'ሁኔታውን ማዘመን አልተቻለም።',
  'Delete this crop and all its records and assessments?': 'ይህን ሰብል እና ሁሉንም መዝገቦቹን እና ግምገማዎቹን ይሰርዙ?',
  'Delete this daily record?': 'ይህን ዕለታዊ መዝገብ ይሰርዙ?',
  'Could not delete that record.': 'ያንን መዝገብ መሰረዝ አልተቻለም።',
  'Back to crops': 'ወደ ሰብሎች ተመለስ',
  'AI plan fallback': 'የAI እቅድ አማራጭ',
  'Planted {date} · plan from {source}': 'የተተካ {date} · እቅድ ከ{source}',
  "Log today's record": 'የዛሬን መዝገብ አስገባ',
  'Scan photo': 'ፎቶ ቃኝ',
  'Pre-prediction report': 'የቅድመ-ትንበያ ሪፖርት',
  '{stage} · day {day} of {total}': '{stage} · ቀን {day} ከ{total}',
  "Missing records have already lowered this crop's health by {n} points.": 'የጎደሉ መዝገቦች የዚህን ሰብል ጤና በ{n} ነጥብ ቀንሰውታል።',
  'Record keeping is protecting this crop’s predicted health.': 'መዝገብ መያዝ የዚህን ሰብል የተተነበየ ጤና ይጠብቃል።',
  '{risk} risk': '{risk} አደጋ',
  '{n}% damage': '{n}% ጉዳት',
  '{n}% yield forecast': '{n}% የምርት ትንበያ',
  '{n}% confidence': '{n}% እርግጠኝነት',
  'Season progress': 'የወቅት ሂደት',
  'Next: {stage}': 'ቀጣይ፦ {stage}',
  Harvest: 'መከር',
  'Water today': 'ዛሬ ውሃ',
  Records: 'መዝገቦች',
  'Record completeness': 'የመዝገብ ሙሉነት',
  'Predicted harvest': 'የተተነበየ መከር',
  'Harvest shift': 'የመከር ለውጥ',
  'Water balance 7d': 'የ7 ቀን ውሃ ሚዛን',
  '{n} days later': '{n} ቀናት በኋላ',
  'Health trend': 'የጤና አዝማሚያ',
  'Last 21 days, reconstructed from records and AI verdicts.': 'ያለፉት 21 ቀናት፣ ከመዝገቦች እና ከAI ፍርዶች የተገነባ።',
  'Today not logged': 'ዛሬ አልተመዘገበም',
  Warnings: 'ማስጠንቀቂያዎች',
  'Why the prediction is moving, and what to do about it.': 'ትንበያው ለምን እየተለወጠ እንደሆነ እና ምን ማድረግ እንዳለብዎ።',
  'No warnings': 'ማስጠንቀቂያ የለም',
  'This crop is on track. Keep the daily record going.': 'ይህ ሰብል በትክክለኛው መንገድ ላይ ነው። ዕለታዊ መዝገቡን ይቀጥሉ።',
  'Latest AI assessment': 'የቅርብ ጊዜ የAI ግምገማ',
  'Photo and record verdicts feed directly into the report.': 'የፎቶ እና የመዝገብ ፍርዶች በቀጥታ ወደ ሪፖርቱ ይገባሉ።',
  'New scan': 'አዲስ ቅኝት',
  'No AI baseline yet': 'እስካሁን የAI መነሻ የለም',
  'Scan a photo to let the agronomist judge the real condition of this crop.': 'የግብርና ባለሙያው የዚህን ሰብል እውነተኛ ሁኔታ እንዲገመግም ፎቶ ይቃኙ።',
  'Scan a photo': 'ፎቶ ቃኝ',
  'Care plan': 'የእንክብካቤ እቅድ',
  '{days} days · {source} plan': '{days} ቀናት · የ{source} እቅድ',
  Rebuild: 'እንደገና ገንባ',
  'Water and soil': 'ውሃ እና አፈር',
  'Follow the stage targets above.': 'ከላይ ያሉትን የደረጃ ዒላማዎች ይከተሉ።',
  'Target per day': 'ዕለታዊ ዒላማ',
  'Soil pH': 'የአፈር pH',
  Spacing: 'ክፍተት',
  Sunlight: 'የፀሐይ ብርሃን',
  'Growth stages': 'የእድገት ደረጃዎች',
  'Feeding calendar': 'የማዳበሪያ የቀን መርሐግብር',
  'Day {day}': 'ቀን {day}',
  'Watch for': 'ይከታተሉ',
  'Harvest signs': 'የመከር ምልክቶች',
  'Daily records': 'ዕለታዊ መዝገቦች',
  '{n} stored · newest first': '{n} ተቀምጧል · አዲሱ መጀመሪያ',
  'Add record': 'መዝገብ ጨምር',
  Date: 'ቀን',
  Water: 'ውሃ',
  Height: 'ቁመት',
  Leaves: 'ቅጠሎች',
  Soil: 'አፈር',
  Pests: 'ተባዮች',
  Notes: 'ማስታወሻዎች',
  'Delete record': 'መዝገብ ሰርዝ',
  'No records yet': 'እስካሁን መዝገብ የለም',
  'Log what you did today to start the prediction.': 'ትንበያውን ለመጀመር ዛሬ የሠሩትን ይመዝግቡ።',
  'Field status': 'የሜዳ ሁኔታ',
  'New field record': 'አዲስ የሜዳ መዝገብ',
  'What did you plant?': 'ምን ተከሉ?',
  'MasAI builds a stage-by-stage care plan and starts predicting from the planting date.': 'MasAI ደረጃ በደረጃ የእንክብካቤ እቅድ ገንብቶ ከተከላ ቀን ጀምሮ ይተነብያል።',
  'Check the form': 'ቅጹን ያረጋግጡ',
  'Could not preview the care plan.': 'የእንክብካቤ እቅዱን አስቀድሞ ማየት አልተቻለም።',
  'Could not save this crop.': 'ይህን ሰብል ማስቀመጥ አልተቻለም።',
  'Crop name': 'የሰብል ስም',
  Variety: 'ዝርያ',
  'Field name': 'የሜዳ ስም',
  'Field area (m²)': 'የሜዳ ስፋት (ሜ²)',
  'Planted on': 'የተተካበት ቀን',
  'Planting notes': 'የተከላ ማስታወሻዎች',
  'e.g. Tomato': 'ለምሳሌ ቲማቲም',
  'e.g. Roma VF': 'ለምሳሌ ሮማ VF',
  'e.g. River Plot': 'ለምሳሌ የወንዝ ሜዳ',
  'e.g. 120': 'ለምሳሌ 120',
  'Soil preparation, seed source, irrigation method…': 'የአፈር ዝግጅት፣ የዘር ምንጭ፣ የመስኖ ዘዴ…',
  'Loading crop library…': 'የሰብል ቤተ-መጽሐፍት በመጫን ላይ…',
  'Care plan preview': 'የእንክብካቤ እቅድ ቅድመ እይታ',
  'Generated by Gemini': 'በGemini የተፈጠረ',
  'Built from the local agronomy library': 'ከአካባቢው የግብርና ቤተ-መጽሐፍት የተገነባ',
  Stages: 'ደረጃዎች',
  days: 'ቀናት',
  'L/day': 'ሊ/ቀን',
  'Preview care plan': 'የእንክብካቤ እቅድ ቅድመ እይታ',
  'Save crop': 'ሰብል አስቀምጥ',
  'Opening record form…': 'የመዝገብ ቅጽ በመክፈት ላይ…',
  'Could not open the form': 'ቅጹን መክፈት አልተቻለም',
  'Check the record': 'መዝገቡን ያረጋግጡ',
  'Could not prepare that photo.': 'ያንን ፎቶ ማዘጋጀት አልተቻለም።',
  'Could not save this record.': 'ይህን መዝገብ ማስቀመጥ አልተቻለም።',
  'Back to crop report': 'ወደ ሰብል ሪፖርት ተመለስ',
  'Daily record': 'ዕለታዊ መዝገብ',
  'Log what happened in the field today': 'ዛሬ በሜዳው ላይ የሆነውን ይመዝግቡ',
  '{crop} · day {day} · target {litres} L. Missing days lower the predicted health.': '{crop} · ቀን {day} · ዒላማ {litres} ሊ። የጎደሉ ቀናት የተተነበየውን ጤና ይቀንሳሉ።',
  'Record saved and assessed': 'መዝገቡ ተቀምጦ ተገምግሟል',
  "The report has been updated with today's verdict.": 'ሪፖርቱ በዛሬው ፍርድ ተዘምኗል።',
  Gemini: 'Gemini',
  'Local rules': 'የአካባቢ ደንቦች',
  'AI fallback': 'የAI አማራጭ',
  'See full report': 'ሙሉ ሪፖርቱን ይመልከቱ',
  'Scan a photo too': 'ፎቶም ይቃኙ',
  'Record date': 'የመዝገብ ቀን',
  'Water given (litres)': 'የተሰጠ ውሃ (ሊትር)',
  'Plan target: {n} L': 'የእቅድ ዒላማ፦ {n} ሊ',
  'Plant height (cm)': 'የተክል ቁመት (ሴሜ)',
  'Leaf colour': 'የቅጠል ቀለም',
  'Not recorded': 'አልተመዘገበም',
  'Dark green': 'ጥቁር አረንጓዴ',
  Green: 'አረንጓዴ',
  'Pale / yellow': 'ፈዛዛ / ቢጫ',
  'Brown / dry': 'ቡናማ / ደረቅ',
  Wilting: 'የሚያዝን',
  'Soil moisture': 'የአፈር እርጥበት',
  Moist: 'እርጥብ',
  'Dry / cracked': 'ደረቅ / የተሰነጠቀ',
  'Wet / soggy': 'ርጥብ / የተጨማለቀ',
  'Pests seen': 'የታዩ ተባዮች',
  'e.g. holes in leaves, aphids': 'ለምሳሌ በቅጠሎች ላይ ቀዳዳ፣ አፊዶች',
  'Anything else the model should know…': 'ሞዴሉ ማወቅ ያለበት ሌላ ነገር…',
  Photo: 'ፎቶ',
  'optional — JPEG, PNG or WebP': 'አማራጭ — JPEG፣ PNG ወይም WebP',
  'Photos are stored with the record.': 'ፎቶዎች ከመዝገቡ ጋር ይቀመጣሉ።',
  'Save daily record': 'ዕለታዊ መዝገብ አስቀምጥ',
  'e.g. 240': 'ለምሳሌ 240',
  'e.g. 65': 'ለምሳሌ 65',
  'Photo AI needs a Gemini key': 'የፎቶ AI የGemini ቁልፍ ይፈልጋል',
  'Daily records still work with local rules. To enable photo diagnosis, add': 'ዕለታዊ መዝገቦች በአካባቢ ደንቦች ይሠራሉ። የፎቶ ምርመራን ለማንቃት የሚከተለውን ያክሉ',
  'to server/.env and restart the API.': 'ወደ server/.env እና APIውን እንደገና ያስጀምሩ።',
  'Could not complete that action': 'ያንን እርምጃ ማጠናቀቅ አልተቻለም',
  'Gemini could not analyse the photo': 'Gemini ፎቶውን መተንተን አልቻለም',
  Done: 'ተከናውኗል',
  'Could not attach that scan.': 'ያንን ቅኝት ማገናኘት አልተቻለም።',
  'Delete this scan?': 'ይህን ቅኝት ይሰርዙ?',
  'Could not delete that scan.': 'ያንን ቅኝት መሰረዝ አልተቻለም።',
  'Choose a photo first.': 'መጀመሪያ ፎቶ ይምረጡ።',
  'Could not analyse that photo.': 'ያንን ፎቶ መተንተን አልተቻለም።',
  'Analyse a field photo': 'የሜዳ ፎቶ ይተንትኑ',
  'The verdict can update a crop report or stand alone for later attachment.': 'ፍርዱ የሰብል ሪፖርትን ማዘመን ወይም ለበኋላ ማገናኘት ብቻውን መቆየት ይችላል።',
  'Choose a crop photo': 'የሰብል ፎቶ ይምረጡ',
  'JPEG, PNG or WebP · compressed automatically': 'JPEG፣ PNG ወይም WebP · በራስ-ሰር ይጨመቃል',
  'Browse files': 'ፋይሎችን ያስሱ',
  'Attach to a crop': 'ከሰብል ጋር አገናኝ',
  'optional — updates its report': 'አማራጭ — ሪፖርቱን ያዘምናል',
  'Standalone diagnosis': 'ብቻውን የሚሠራ ምርመራ',
  'no field name': 'የሜዳ ስም የለም',
  'Crop hint': 'የሰብል ጥቆማ',
  'Note for the AI': 'ለAI ማስታወሻ',
  'e.g. tomato with dark spots': 'ለምሳሌ ጥቁር ነጠብጣቦች ያሉት ቲማቲም',
  'e.g. spotted this morning': 'ለምሳሌ ዛሬ ጠዋት ተመልክቷል',
  'Run AI diagnosis': 'የAI ምርመራ አስኪድ',
  'Looking at the photo…': 'ፎቶውን በመመልከት ላይ…',
  'Photo diagnosis': 'የፎቶ ምርመራ',
  'Open updated crop report →': 'የዘመነውን የሰብል ሪፖርት ክፈት →',
  'Standalone scan': 'ብቻውን ቅኝት',
  "Attach it to a crop from the history below to push the verdict into that crop's report.": 'ፍርዱን ወደዚያ ሰብል ሪፖርት ለማስገባት ከታች ካለው ታሪክ ከሰብል ጋር ያገናኙት።',
  'No diagnosis yet': 'እስካሁን ምርመራ የለም',
  'Upload a clear photo of leaves, fruit and soil for the most useful verdict.': 'ለተጠቃሚ ፍርድ የቅጠሎች፣ የፍሬ እና የአፈር ግልጽ ፎቶ ይጫኑ።',
  'Scan history': 'የቅኝት ታሪክ',
  'Last 30 photos. Standalone scans can be attached to a crop later.': 'የመጨረሻዎቹ 30 ፎቶዎች። ብቻውን የተደረጉ ቅኝቶች በኋላ ከሰብል ጋር ሊገናኙ ይችላሉ።',
  '{n} scans': '{n} ቅኝቶች',
  attached: 'ተገናኝቷል',
  standalone: 'ብቻውን',
  '{date} · {score}/100 health · {damage}% damage': '{date} · ጤና {score}/100 · {damage}% ጉዳት',
  'Choose crop…': 'ሰብል ይምረጡ…',
  Attach: 'አገናኝ',
  'Delete scan': 'ቅኝት ሰርዝ',
  'No scans yet': 'እስካሁን ቅኝት የለም',
  'Your photo diagnoses will appear here.': 'የፎቶ ምርመራዎችዎ እዚህ ይታያሉ።',
  'This field is not on the map': 'ይህ ሜዳ በካርታው ላይ የለም',
  'The page you were looking for does not exist.': 'የፈለጉት ገጽ የለም።',
  'Back to dashboard': 'ወደ ዳሽቦርድ ተመለስ',
  local: 'አካባቢያዊ',
  demo: 'ማሳያ',
  'local-rules': 'የአካባቢ ደንቦች',
  photo: 'ፎቶ',
  'Checking your session…': 'ክፍለ ጊዜዎን በመፈተሽ ላይ…',
  'That crop link is not valid.': 'የሰብል አገናኙ ትክክል አይደለም።',
  'Enter a crop name first.': 'መጀመሪያ የሰብል ስም ያስገቡ።',
  hours: 'ሰዓታት',
  'Selected field record': 'የተመረጠ የሜዳ መዝገብ',
  'Selected crop': 'የተመረጠ ሰብል',
  'Verdict applied to the crop report.': 'ፍርዱ ወደ ሰብል ሪፖርቱ ተተግብሯል።',
  '{n} day gap': '{n} ቀን ክፍተት',
  '{n} L target': 'ዒላማ {n} ሊ',
  Condition: 'ሁኔታ',
  'Condition baseline': 'የሁኔታ መነሻ',
  'Health score': 'የጤና ነጥብ',
  Damage: 'ጉዳት',
  'Harvest window': 'የመከር ጊዜ',
};

const severityAm: Record<string, string> = {
  critical: 'ወሳኝ',
  high: 'ከፍተኛ',
  medium: 'መካከለኛ',
  low: 'ዝቅተኛ',
  info: 'መረጃ',
  none: 'ምንም',
};

const riskAm: Record<string, string> = {
  low: 'ዝቅተኛ',
  moderate: 'መካከለኛ',
  high: 'ከፍተኛ',
  severe: 'አስከፊ',
};

const statusAm: Record<string, string> = {
  active: 'ንቁ',
  harvested: 'ተሰብስቧል',
  failed: 'አልተሳካም',
};

const categoryAm: Record<string, string> = {
  healthy: 'ጤናማ',
  stressed: 'ጭንቀት ላይ',
  needs_attention: 'ትኩረት ይፈልጋል',
  recovering: 'እያገገመ',
  damaged: 'ተጎድቷል',
  diseased: 'በሽታ አለበት',
  pest: 'ተባይ ጥቃት',
};

const stageAm: Record<string, string> = {
  establishment: 'ምስረታ',
  vegetative: 'የእድገት ደረጃ',
  flowering: 'የአበባ ጊዜ',
  fruiting: 'የፍሬ ጊዜ',
  maturity: 'የብስለት ጊዜ',
  germination: 'ማብቀል',
  'leaf growth': 'የቅጠል እድገት',
  'heading up': 'ራስ መልበስ',
  'top growth': 'የላይኛው እድገት',
  'root bulking': 'ሥር መሙላት',
  emergence: 'መብቀል',
  tillering: 'ጎን መተካት',
  'heading and flowering': 'ራስ እና አበባ',
  'grain fill and dry-down': 'እህል መሙላት',
  'flowering and pod set': 'አበባ እና ኮረኮሬ',
  'pod fill': 'ኮረኮሬ መሙላት',
  'canopy growth': 'የዛፍ ጥላ እድገት',
  'fruit development': 'ፍሬ እድገት',
  ripening: 'መብሰል',
};

const interpolate = (template: string, vars?: Vars) =>
  template.replace(/\{(\w+)\}/g, (_match, key: string) => (vars && key in vars ? String(vars[key]) : `{${key}}`));

interface I18nValue {
  lang: Language;
  setLang: (language: Language) => void;
  t: (text: string, vars?: Vars) => string;
}

const I18nContext = createContext<I18nValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLanguage] = useState<Language>(() => getStoredLanguage());

  useEffect(() => {
    document.documentElement.lang = lang;
    document.title = lang === 'am' ? 'MasAI · ቅድመ-ትንበያ እርሻ' : 'MasAI · Pre-Prediction Farming';
  }, [lang]);

  const value = useMemo<I18nValue>(() => {
    const setLang = (next: Language) => {
      storeLanguage(next);
      setLanguage(next);
    };
    const t = (text: string, vars?: Vars) => {
      const template = lang === 'am' ? am[text] ?? text : text;
      return interpolate(template, vars);
    };
    return { lang, setLang, t };
  }, [lang]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const value = useContext(I18nContext);
  if (!value) throw new Error('useI18n must be used inside LanguageProvider');
  return value;
}

export const severityText = (severity: string, lang: Language) =>
  lang === 'am' ? severityAm[severity] ?? severity : severity;

export const riskText = (risk: string, lang: Language) => (lang === 'am' ? riskAm[risk] ?? risk : risk);

export const statusText = (status: string, lang: Language) => (lang === 'am' ? statusAm[status] ?? status : status);

export const categoryText = (category: string, lang: Language) =>
  lang === 'am' ? categoryAm[category] ?? category.replace(/_/g, ' ') : category.replace(/_/g, ' ');

export const healthLabel = (score: number, lang: Language) => {
  if (lang === 'en') {
    if (score >= 85) return 'Thriving';
    if (score >= 70) return 'Healthy';
    if (score >= 55) return 'Needs watching';
    if (score >= 40) return 'At risk';
    return 'Critical';
  }
  if (score >= 85) return 'በጣም ጥሩ';
  if (score >= 70) return 'ጤናማ';
  if (score >= 55) return 'ክትትል ይፈልጋል';
  if (score >= 40) return 'አደጋ ላይ';
  return 'ወሳኝ';
};

export const stageText = (stage: PlanStage | null | undefined, lang: Language) => {
  if (!stage) return lang === 'am' ? 'በእድገት ላይ' : 'Growing';
  return lang === 'am' ? stageAm[stage.key] ?? stage.label : stage.label;
};

export const sourceText = (source: string, lang: Language) => (lang === 'am' ? am[source] ?? source : source);

export function warningText(
  warning: CropWarning,
  lang: Language,
  prediction?: Prediction,
  assessment?: Assessment | null,
) {
  if (lang === 'en') return { title: warning.title, detail: warning.detail, action: warning.action };

  const p = prediction;
  switch (warning.code) {
    case 'record_missing_today':
      return {
        title: `ዛሬ ለ${warning.cropName} መዝገብ አልተመዘገበም`,
        detail: 'ሞዴሉ ዛሬን እንደ ያልተረጋገጠ ይመለከታል። እያንዳንዱ ባዶ ቀን የጤና ግምቱን ይቀንሳል።',
        action: 'የዛሬን መዝገብ ያክሉ',
      };
    case 'record_streak':
      return {
        title: `${p?.recordStats.streakMissed ?? 0} ቀናት ያለ መዝገብ`,
        detail: `ያልተመዘገበ ጭንቀት ይከማቻል፡ የ${warning.cropName} ጤና ግምት በ${p?.recordPenalty ?? 0} ነጥብ ቀንሷል።`,
        action: 'መዝገብ ያስገቡ እና በፎቶ እንደገና ይመርምሩ',
      };
    case 'no_baseline':
      return {
        title: 'ለዚህ ሰብል የAI መነሻ ግምገማ የለም',
        detail: 'ያለ ፎቶ ምርመራ ስርዓቱ ጤናውን ከመዝገቦች ብቻ ይገምታል። መነሻ ግምገማ እውነተኛውን ሁኔታ ያረጋግጣል።',
        action: 'መነሻ ለመፍጠር ፎቶ ይቃኙ',
      };
    case 'stale_assessment':
      return {
        title: `የመጨረሻው AI ፍተሻ ከ${p?.daysSinceAssessment ?? 0} ቀናት በፊት ነበር`,
        detail: 'የእይታ ሁኔታ ከመዝገቦች በፍጥነት ይለወጣል። አዲስ ፎቶ ግምቱን ትክክለኛ ያደርገዋል።',
        action: 'አዲስ ፎቶ ይቃኙ',
      };
    case 'damage_detected':
      return {
        title: `${assessment?.conditionLabel ?? warning.title} ተገኝቷል`,
        detail: assessment?.summary ?? 'ሁኔታው አስቸኳይ እርምጃ ይፈልጋል።',
        action: 'የሕክምና እርምጃዎቹን ይከተሉ',
      };
    case 'water_deficit':
      return {
        title: `ውሃ ከዒላማው ${100 - (p?.water.balancePct ?? 0)}% ያነሰ ነው`,
        detail: `መዝገቦች ${p?.water.loggedLast7Days ?? 0} ሊትር ያሳያሉ፣ የ7 ቀን ፍላጎት ${p?.water.requiredLast7Days ?? 0} ሊትር ነው።`,
        action: `ዛሬ ${p?.water.expectedToday ?? 0} ሊትር ያጠጡ`,
      };
    case 'water_excess':
      return {
        title: 'ከመጠን በላይ ውሃ ሊሆን ይችላል',
        detail: `መዝገቦች ${p?.water.loggedLast7Days ?? 0} ሊትር ያሳያሉ፣ ዒላማው ${p?.water.requiredLast7Days ?? 0} ሊትር ነው።`,
        action: 'ዛሬ መስኖ ያቁሙ እና ፍሳሽን ይፈትሹ',
      };
    case 'past_harvest_window':
      return {
        title: `ከተጠበቀው መከር ${p?.overdueDays ?? 0} ቀናት አልፏል`,
        detail: `እቅዱ ${warning.cropName} በቀን ${p?.expectedDays ?? 0} ዝግ ይሆናል ብሎ ጠብቆ ነበር። ጥራት ከመቀነሱ በፊት ሜዳውን ይመልከቱ።`,
        action: 'የተዘጋጀውን ይመልከቱ እና ይሰብስቡ',
      };
    case 'harvest_window':
      return {
        title: `የመከር ጊዜ በ${p?.daysToHarvest ?? 0} ቀናት ይከፈታል`,
        detail: 'ከዛሬ ጀምሮ በየቀኑ የብስለት ምልክቶችን ይመልከቱ።',
        action: 'ሳጥኖችን እና ሠራተኞችን ያዘጋጁ',
      };
    case 'low_health':
      return {
        title: `የተተነበየው ጤና ${p?.healthScore ?? 0}/100 ነው`,
        detail: `ሞዴሉ ${p?.damagePercent ?? 0}% ጉዳት እና ${p?.harvestDelayDays ?? 0} ቀናት መዘግየት ይተነብያል።`,
        action: 'ፎቶ ይቃኙ እና በግኝቶቹ ላይ እርምጃ ይውሰዱ',
      };
    default:
      return { title: warning.title, detail: warning.detail, action: warning.action };
  }
}
