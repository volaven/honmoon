export const scrollbarTheme = `
@media (forced-colors: none) {
  * { scrollbar-color: auto !important; scrollbar-width: auto !important; }
  *::-webkit-scrollbar { width: 11px !important; height: 11px !important; }
  *::-webkit-scrollbar-track, *::-webkit-scrollbar-corner { background: #141017 !important; }
  *::-webkit-scrollbar-thumb { background: #806095 !important; border: 3px solid #141017 !important; border-radius: 8px !important; }
  *::-webkit-scrollbar-thumb:hover { background: #ed67b3 !important; }
  *::-webkit-scrollbar-thumb:active { background: #ff39ad !important; }
  *::-webkit-scrollbar-button { display: none !important; }
}`;
