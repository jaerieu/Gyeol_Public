# E13 Post-Hoc Ablation: `jsonchain` Without `grounds` & `quotes` (`deepseek_on`, n=10 Scenarios)

| format | settled | brk | L | L_strict | V | Vh | R_cur | R_lin | cNew | cOld | cEdge | amend | withdraw | recompute | units | h30Chars | USD | leakedGQ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| natural | 10 | 0 | 0.683 | 0.683 | 0.988 | 0.990 | 0.571 | 0.610 | 0.738 | 0.704 | 0.683 | 0.930 | 1.000 | 0.469 | 95.7 | 6326 | 1.6795 | 0 |
| json | 10 | 0 | 0.626 | 0.626 | 0.994 | 0.995 | 0.897 | 0.906 | 0.679 | 0.632 | 0.626 | 0.980 | 1.000 | 0.331 | 81.7 | 9895 | 1.4677 | 0 |
| jsonchain_nogq | 10 | 0 | 0.728 | 0.728 | 0.915 | 0.938 | 0.895 | 0.926 | 0.781 | 0.730 | 0.736 | 0.960 | 1.000 | 0.531 | 95.1 | 12604 | 1.8398 | 0 |
| jsonchain | 10 | 0 | 0.958 | 0.936 | 1.000 | 1.000 | 0.995 | 0.994 | 0.974 | 0.958 | 0.958 | 1.000 | 1.000 | 0.924 | 144.3 | 28959 | 2.5007 | 0 |
| lon | 10 | 0 | 0.977 | 0.977 | 1.000 | 1.000 | 0.997 | 0.994 | 0.991 | 0.983 | 0.977 | 1.000 | 1.000 | 0.959 | 147.5 | 19001 | 2.2108 | 0 |

## Paired Two-Sided Exact Sign-Flip Contrasts (n=10 Scenarios)
| metric | contrast | n | diff | 95% CI | exact p |
|---|---|---|---|---|---|
| L | jsonchain_nogq minus json | 10 | 0.102 | 0.006 to 0.213 | 0.1172 |
| L | jsonchain minus jsonchain_nogq | 10 | 0.230 | 0.115 to 0.345 | 0.0098 |
| L | lon minus jsonchain_nogq | 10 | 0.249 | 0.134 to 0.364 | 0.0117 |
| L | jsonchain_nogq minus natural | 10 | 0.045 | -0.102 to 0.211 | 0.6094 |
| V | jsonchain_nogq minus json | 10 | -0.079 | -0.124 to -0.038 | 0.0156 |
| V | jsonchain minus jsonchain_nogq | 10 | 0.085 | 0.041 to 0.132 | 0.0156 |
| V | lon minus jsonchain_nogq | 10 | 0.085 | 0.041 to 0.132 | 0.0156 |
| readerLin | jsonchain_nogq minus json | 10 | 0.019 | -0.019 to 0.061 | 0.4844 |
| readerLin | jsonchain minus jsonchain_nogq | 10 | 0.068 | 0.032 to 0.100 | 0.0156 |
| readerLin | lon minus jsonchain_nogq | 10 | 0.068 | 0.032 to 0.100 | 0.0156 |

## Static Session Audit & Tamper (deepseek_on)
| format | sTP | sFP | sFN | sTN | alteredQuotes | totalQuotes | tchars | rchars | tin | tout | cached |
|---|---|---|---|---|---|---|---|---|---|---|---|
| natural | 8 | 2 | 0 | 0 | 211 | 2673 | 990474 | 3039634 | 555160 | 1200721 | 446080 |
| json | 3 | 0 | 7 | 0 | 7 | 628 | 1568234 | 2573198 | 708733 | 1186353 | 573184 |
| jsonchain_nogq | 9 | 1 | 0 | 0 | 264 | 2542 | 1968311 | 3193888 | 836845 | 1467667 | 691008 |
| jsonchain | 1 | 0 | 4 | 5 | 0 | 1123 | 4367219 | 2477206 | 1588835 | 2010927 | 1323200 |
| lon | 0 | 2 | 3 | 5 | 0 | 941 | 2863542 | 3012023 | 1625645 | 1783698 | 1419648 |
