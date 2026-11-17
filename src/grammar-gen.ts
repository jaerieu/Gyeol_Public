// 결 v0.8.5 오픈웨이트 제약 디코딩용 EBNF / GBNF 생성기 (IETF/ISO 스타일 EBNF & llama.cpp GBNF)
import type { Profile } from './types.ts';
import { LON_ACT, LON_EV, LON_FIG, LON_PROCESS, LON_TENSE } from './tables.ts';

export interface GrammarGenOptions {
  profile?: Profile;
  mode?: 'delta' | 'snapshot';
  edition?: string;
}

export function generateEbnf(opts: GrammarGenOptions = {}): string {
  const profile: Profile = opts.profile === 'lon' ? 'lon' : 'gyeol';
  const edition = opts.edition ?? '0.8.5';
  const mode = opts.mode ?? (profile === 'lon' ? 'delta' : 'snapshot');
  if (profile === 'lon') {
    return [
      `(* Gyeol;Lon ${edition} EBNF (${mode}) *)`,
      `message   = header , nl , { line , nl } ;`,
      `header    = "lon ${edition}" , " · " , ( "delta" | "snapshot" ) , [ " · lang " , lang ] ;`,
      `line      = [ "lon: " ] , clause , { " " , clause } , { " " , extblock } ;`,
      `clause    = "<" , cnum , " " , dot_addr , [ " " , prefix ] , " " , markers , " " , body , " " , tail , ">" ;`,
      `dot_addr  = "·" | "·→" , id | "· ●" ;`,
      `prefix    = ( "fix→" | "err→" | "sup→" | "↔" | "↖" ) , cnum ;`,
      `markers   = "[" , [ ev , "," ] , [ "lim," ] , [ tense , "," ] , act , "]" ;`,
      `ev        = ${[...LON_EV].map((x) => `"${x}"`).join(' | ')} ;`,
      `tense     = ${[...LON_TENSE].map((x) => `"${x}"`).join(' | ')} ;`,
      `act       = ${[...LON_ACT].map((x) => `"${x}"`).join(' | ')} ;`,
      `tail      = "*" , [ digit | "?" ] , ":" , digit , { ground } ;`,
      `ground    = "↓" , ( cnum | "T" , int | ( "evd" | "ref" | "calc" ) , cnum | "dict" | uri ) ;`,
      `extblock  = ( "evd" | "ref" | "calc" ) , cnum , " <[" , { char } , "]>" ;`,
    ].join('\n');
  }
  return [
    `(* Gyeol ${edition} EBNF *)`,
    `message   = [ header , nl ] , { line , nl } ;`,
    `header    = "gyeol ${edition}" , [ " · lang " , lang ] ;`,
    `line      = clause , { " " , clause } , { " " , extblock } ;`,
    `clause    = "<" , cnum , " " , dot_addr , [ " " , prefix ] , " " , markers , " " , body , " " , tail , ">" ;`,
    `dot_addr  = "·" | "·→" , id | "· ●" ;`,
    `prefix    = ( ${[...LON_PROCESS].map((x) => `"${x}→"`).join(' | ')} | "↔" | "↖" ) , cnum ;`,
    `markers   = "[" , [ ev , "," ] , [ "new," ] , [ fig , "," ] , [ tense , "," ] , act , "]" ;`,
    `ev        = "see" | "rec" | "inf" | "gut" | "if" | "top" ;`,
    `fig       = ${[...LON_FIG].map((x) => `"${x}"`).join(' | ')} | "pdx" | "met" ;`,
    `tense     = "pst" | "fut" ;`,
    `act       = "say" | "ask" | "req" | "let" | "vow" | "nay" | "ack" ;`,
    `tail      = "*" , [ digit | "?" ] , color , digit , { ground } ;`,
    `color     = "R" | "G" | "B" | "C" | "M" | "Y" | "K" ;`,
    `ground    = "↓" , ( cnum | "T" , int | ( "evd" | "ref" | "calc" ) , cnum | "dict" | uri ) ;`,
    `extblock  = ( "evd" | "ref" | "calc" ) , cnum , " <[" , { char } , "]>" ;`,
  ].join('\n');
}

export function generateGbnf(opts: GrammarGenOptions = {}): string {
  const profile: Profile = opts.profile === 'lon' ? 'lon' : 'gyeol';
  const edition = opts.edition ?? '0.8.5';
  const mode = opts.mode ?? (profile === 'lon' ? 'delta' : 'snapshot');
  if (profile === 'lon') {
    return [
      `# Gyeol;Lon ${edition} (${mode}) GBNF`,
      `root ::= header "\\n" line+`,
      `header ::= "lon ${edition} · " ("delta" | "snapshot") (" · lang " [a-z-]+)?`,
      `line ::= ("lon: ")? clause (" " clause)* (" " extblock)* "\\n"`,
      `clause ::= "<" cnum " " dotaddr (" " prefix)? " " markers " " body " " tail ">"`,
      `dotaddr ::= "·" | "·→" id | "· ●"`,
      `prefix ::= ("fix→" | "err→" | "sup→" | "↔" | "↖") cnum`,
      `markers ::= "[" (ev ",")? ("lim,")? (tense ",")? act "]"`,
      `ev ::= "see" | "rec" | "inf" | "gut" | "if"`,
      `tense ::= "pst" | "fut"`,
      `act ::= "say" | "ask" | "req" | "let" | "vow" | "nay" | "ack"`,
      `tail ::= "*" ([0-9] | "?")? ":" [0-9] ground*`,
      `ground ::= "↓" (cnum | "T" [0-9]+ | ("evd" | "ref" | "calc") cnum | "dict")`,
      `extblock ::= ("evd" | "ref" | "calc") cnum " <[" [^\\]]+ "]>"`,
      `cnum ::= [0-9]+ ("." [0-9]+)?`,
      `id ::= [A-Za-z0-9_.-]+`,
      `body ::= [^<>\\[\\]*]+`,
    ].join('\n');
  }
  return [
    `# Gyeol ${edition} GBNF`,
    `root ::= (header "\\n")? line+`,
    `header ::= "gyeol ${edition}" (" · lang " [a-z-]+)?`,
    `line ::= clause (" " clause)* (" " extblock)* "\\n"`,
    `clause ::= "<" cnum " " dotaddr (" " prefix)? " " markers " " body " " tail ">"`,
    `dotaddr ::= "·" | "·→" id | "· ●"`,
    `prefix ::= ("fix→" | "err→" | "sup→" | "↔" | "↖") cnum`,
    `markers ::= "[" (ev ",")? ("new,")? (fig ",")? (tense ",")? act "]"`,
    `ev ::= "see" | "rec" | "inf" | "gut" | "if" | "top"`,
    `fig ::= "lim" | "pdx" | "met"`,
    `tense ::= "pst" | "fut"`,
    `act ::= "say" | "ask" | "req" | "let" | "vow" | "nay" | "ack"`,
    `tail ::= "*" ([0-9] | "?")? [RGBCMYK] [0-9] ground*`,
    `ground ::= "↓" (cnum | "T" [0-9]+ | ("evd" | "ref" | "calc") cnum | "dict")`,
    `extblock ::= ("evd" | "ref" | "calc") cnum " <[" [^\\]]+ "]>"`,
    `cnum ::= [0-9]+ ("." [0-9]+)?`,
    `id ::= [A-Za-z0-9_.-]+`,
    `body ::= [^<>\\[\\]*]+`,
  ].join('\n');
}
