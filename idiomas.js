// Traducción de la interfaz de Pillao (español de España → español de Latinoamérica, portugués de Brasil e inglés).
// La web se escribe en español de España; este archivo cambia los textos que se ven en pantalla (y los de los botones
// para lectores de pantalla) sin tocar los nombres de juegos ni de tiendas. Los textos con « · » se traducen por trozos.
(function () {
  "use strict";
  var MESES = { en: { ene: "Jan", feb: "Feb", mar: "Mar", abr: "Apr", may: "May", jun: "Jun", jul: "Jul", ago: "Aug", sept: "Sep", sep: "Sep", oct: "Oct", nov: "Nov", dic: "Dec", enero: "January", febrero: "February", marzo: "March", abril: "April", mayo: "May", junio: "June", julio: "July", agosto: "August", septiembre: "September", octubre: "October", noviembre: "November", diciembre: "December" },
    pt: { ene: "jan", feb: "fev", mar: "mar", abr: "abr", may: "mai", jun: "jun", jul: "jul", ago: "ago", sept: "set", sep: "set", oct: "out", nov: "nov", dic: "dez", enero: "janeiro", febrero: "fevereiro", marzo: "março", abril: "abril", mayo: "maio", junio: "junho", julio: "julho", agosto: "agosto", septiembre: "setembro", octubre: "outubro", noviembre: "novembro", diciembre: "dezembro" } };
  var fecha = function (l) { return function (s) { return String(s).replace(/\b(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre|ene|feb|mar|abr|may|jun|jul|ago|sept|sep|oct|nov|dic)\b/g, function (m) { return MESES[l][m] || m; }); }; };

  // Textos enteros (o trozos entre « · »)
  var EN = {
    "Busca un juego…": "Search for a game…", "Buscar juego": "Search game", "Buscar precios nuevos": "Check for new prices", "Cerrar": "Close", "Filtros": "Filters", "Filtros rápidos": "Quick filters",
    "Formato": "Format", "Estado": "Condition", "Estado ▾": "Condition ▾", "Plataforma": "Platform", "Tipo de producto": "Product type", "Idioma": "Language", "Región e idioma": "Region & language",
    "Región · precios y tiendas": "Region · prices and stores", "Más filtros": "More filters", "Más filtros: formato, estado y tipo": "More filters: format, condition and type", "Recoger formato, estado y tipo": "Hide format, condition and type",
    "Digital": "Digital", "En disco": "Physical", "Disco": "Physical", "Nuevo": "New", "Segunda mano": "Pre-owned", "Usado": "Used", "Juegos": "Games", "Tarjetas regalo": "Gift cards", "Software": "Software", "Skins": "Skins", "Skin": "Skin",
    "🔥 Chollos de hoy": "🔥 Today's deals", "📦 Packs": "📦 Bundles", "🎨 Skins": "🎨 Skins", "Ver chollos →": "See deals →", "Ordenar": "Sort by", "Populares": "Popular", "Lanzamientos recientes": "Recent releases",
    "Próximos lanzamientos": "Upcoming releases", "Mayor descuento": "Biggest discount", "Más barato": "Cheapest", "Premiados": "Award winners", "Packs y bundles": "Bundles", "Claves sorpresa": "Mystery keys", "Clave sorpresa": "Mystery key",
    "Ver en cuadrícula": "Grid view", "Ver en lista": "List view", "Mejor precio": "Best price", "Mejor precio con envío": "Best price with shipping", "Nuevo desde": "New from", "PVP": "RRP", "Mínimo histórico": "All-time low",
    "Nunca ha estado más barato": "Never been cheaper", "el más barato": "the cheapest", "Ver oferta": "See deal", "Ir": "Go", "Agotado": "Out of stock", "Sin precio automático. Búscalo en:": "No automatic price. Search it on:",
    "Con el cupón": "With coupon", "Copiar": "Copy", "Copiar código": "Copy code", "¡Copiado!": "Copied!", "código": "code", "Claves": "Keys", "Oficial": "Official", "Revendedor": "Key reseller", "Marketplace": "Marketplace", "Tienda": "Store",
    "Particulares": "Private sellers", "Tiendas": "Stores", "Oficiales": "Official stores", "Revendedores de claves": "Key resellers", "Mercados de claves": "Key marketplaces", "Tiendas físicas": "Retail stores", "Tiendas de segunda mano": "Pre-owned stores",
    "Marcar todas": "Select all", "Quitar todas": "Clear all", "Marcar todos": "Select all", "Quitar todos": "Clear all", "Más revendedores": "More resellers", "Tiendas que comparamos": "Stores we compare", "Ver más juegos": "Show more games",
    "Precio máximo": "Max price", "Sin límite": "No limit", "Solo con stock": "In stock only", "Incluir marketplaces": "Include marketplaces", "Incluir particulares": "Include private sellers", "Incluir juegos de importación": "Include imported games",
    "Claves vendidas por terceros (G2A, Eneba)": "Keys sold by third parties (G2A, Eneba)", "Segunda mano entre personas (Wallapop, eBay). Paga siempre por el envío protegido de la web.": "Second-hand between individuals (Wallapop, eBay). Always pay through the site's protected shipping.",
    "Juegos en disco de otros países (UK, EE. UU., Japón…). Funcionan en consolas españolas, pero la caja o los textos pueden venir en otro idioma.": "Physical games from other countries (UK, US, Japan…). They work on Spanish consoles, but the box or texts may be in another language.",
    "Listo": "Done", "Quitar filtros": "Clear filters", "No hay resultados": "No results", "Nada con estos filtros": "Nothing with these filters", "Prueba a quitar alguno.": "Try removing some.", "Vuelve a probar en unos minutos.": "Try again in a few minutes.",
    "Buscando en todo el catálogo…": "Searching the whole catalogue…", "Un momento.": "One moment.", "Cargando…": "Loading…", "Edición especial": "Special edition", "Edición": "Edition", "DLC": "DLC", "Tarjeta regalo": "Gift card", "Tarjeta": "Card",
    "Reserva": "Pre-order", "Novedad": "New release", "Ahora no": "Not now", "Ya a la venta": "Out now", "está a punto de salir": "is about to launch", "días": "days", "horas": "hours", "min": "min", "Tiempo hasta el lanzamiento": "Time until launch",
    "Precios orientativos · algunos enlaces son de afiliado": "Approximate prices · some links are affiliate links", "Precios orientativos": "Approximate prices", "algunos enlaces son de afiliado": "some links are affiliate links",
    "Historial y aviso de precio": "Price history & alert", "Historial de precios y crear aviso por email": "Price history and email alert", "Avisos por email": "Email alerts", "Confirmar": "Confirm", "Guardando…": "Saving…",
    "Aviso legal": "Legal notice", "Condiciones de uso": "Terms of use", "Privacidad": "Privacy", "Cookies": "Cookies", "Configurar cookies": "Cookie settings", "Información legal": "Legal information", "Más información": "More information",
    "Tu privacidad": "Your privacy", "Aceptar todo": "Accept all", "Rechazar todo": "Reject all", "Configurar": "Settings", "Guardar selección": "Save choice", "Necesarias": "Necessary", "Preferencias": "Preferences", "Tus datos": "Your data",
    "Solo guardan tu elección sobre cookies. Siempre activas.": "They only store your cookie choice. Always on.", "Recuerdan tus filtros, tus búsquedas recientes y tus avisos de precio.": "They remember your filters, recent searches and price alerts.",
    "Pillao no usa cookies de publicidad ni de analítica. Solo te pedimos permiso para recordar": "Pillao uses no advertising or analytics cookies. We only ask permission to remember",
    "tus filtros, tus últimas búsquedas y tus avisos de precio": "your filters, your latest searches and your price alerts", "en este navegador.": "in this browser.",
    "compara precios de videojuegos y no vende productos. Los precios son orientativos y se actualizan varias veces al día: el precio válido es siempre el de cada tienda. Algunos enlaces son de afiliado: si compras tras pulsarlos, la tienda puede pagarnos una pequeña comisión, sin coste para ti.": "compares video game prices and does not sell products. Prices are approximate and updated several times a day: the valid price is always the store's. Some links are affiliate links: if you buy after clicking them, the store may pay us a small commission at no cost to you.",
    "Te avisamos de las bajadas de precio más fuertes en cuanto aparecen. Gratis y sin spam.": "We alert you to the biggest price drops as soon as they appear. Free and no spam.", "Unirme →": "Join →", "Telegram de ofertas: Pillao Chollos": "Deals on Telegram: Pillao Chollos",
    "Europa": "Europe", "Latinoamérica": "Latin America", "Precios en euros · claves de España, Europa y globales": "Prices in euros · keys for Spain, Europe and global", "Precios en dólares · claves de Latinoamérica y globales": "Prices in US dollars · keys for Latin America and global",
    "Elegido según el idioma de tu navegador. Puedes cambiarlo cuando quieras.": "Chosen from your browser's language. You can change it any time.", "Elegido según el idioma de tu teléfono. Puedes cambiarlo cuando quieras.": "Chosen from your phone's language. You can change it any time.", "Idioma elegido por ti.": "Language chosen by you.",
    "Confianza": "Trust", "Tienda oficial": "Official store", "Sin nota en Trustpilot": "No Trustpilot rating", "Solo enlace de búsqueda": "Search link only", "Ver menos": "Show less", "Ver menos ▴": "Show less ▴", "¿o sorpresa?": "or mystery?",
    "Todas las tiendas": "All stores", "Con cupones": "With coupons", "Sin cupones": "Without coupons", "Cupones activos": "Active coupons", "Global": "Global", "Region free": "Region free", "válida en España": "valid in Spain", "Importación": "Import",
    "Parece que estás en Latinoamérica": "Looks like you're in Latin America", "Parece que estás en España o en Europa": "Looks like you're in Spain or Europe", "Ver Latinoamérica": "See Latin America", "Ver Europa": "See Europe", "Quedarme aquí": "Stay here",
    "Juego del Año": "Game of the Year"
  };
  var PT = {
    "Busca un juego…": "Busque um jogo…", "Buscar juego": "Buscar jogo", "Buscar precios nuevos": "Buscar preços novos", "Cerrar": "Fechar", "Filtros": "Filtros", "Filtros rápidos": "Filtros rápidos",
    "Formato": "Formato", "Estado": "Estado", "Estado ▾": "Estado ▾", "Plataforma": "Plataforma", "Tipo de producto": "Tipo de produto", "Idioma": "Idioma", "Región e idioma": "Região e idioma",
    "Región · precios y tiendas": "Região · preços e lojas", "Más filtros": "Mais filtros", "Más filtros: formato, estado y tipo": "Mais filtros: formato, estado e tipo", "Recoger formato, estado y tipo": "Ocultar formato, estado e tipo",
    "Digital": "Digital", "En disco": "Mídia física", "Disco": "Mídia física", "Nuevo": "Novo", "Segunda mano": "Usado", "Usado": "Usado", "Juegos": "Jogos", "Tarjetas regalo": "Gift cards", "Software": "Software", "Skins": "Skins", "Skin": "Skin",
    "🔥 Chollos de hoy": "🔥 Ofertas de hoje", "📦 Packs": "📦 Pacotes", "🎨 Skins": "🎨 Skins", "Ver chollos →": "Ver ofertas →", "Ordenar": "Ordenar", "Populares": "Populares", "Lanzamientos recientes": "Lançamentos recentes",
    "Próximos lanzamientos": "Próximos lançamentos", "Mayor descuento": "Maior desconto", "Más barato": "Mais barato", "Premiados": "Premiados", "Packs y bundles": "Pacotes e bundles", "Claves sorpresa": "Chaves surpresa", "Clave sorpresa": "Chave surpresa",
    "Ver en cuadrícula": "Ver em grade", "Ver en lista": "Ver em lista", "Mejor precio": "Melhor preço", "Mejor precio con envío": "Melhor preço com frete", "Nuevo desde": "Novo a partir de", "PVP": "Preço sugerido", "Mínimo histórico": "Menor preço histórico",
    "Nunca ha estado más barato": "Nunca esteve tão barato", "el más barato": "o mais barato", "Ver oferta": "Ver oferta", "Ir": "Ir", "Agotado": "Esgotado", "Sin precio automático. Búscalo en:": "Sem preço automático. Procure em:",
    "Con el cupón": "Com o cupom", "Copiar": "Copiar", "Copiar código": "Copiar código", "¡Copiado!": "Copiado!", "código": "código", "Claves": "Chaves", "Oficial": "Oficial", "Revendedor": "Revendedor", "Marketplace": "Marketplace", "Tienda": "Loja",
    "Particulares": "Particulares", "Tiendas": "Lojas", "Oficiales": "Oficiais", "Revendedores de claves": "Revendedores de chaves", "Mercados de claves": "Marketplaces de chaves", "Tiendas físicas": "Lojas físicas", "Tiendas de segunda mano": "Lojas de usados",
    "Marcar todas": "Marcar todas", "Quitar todas": "Desmarcar todas", "Marcar todos": "Marcar todos", "Quitar todos": "Desmarcar todos", "Más revendedores": "Mais revendedores", "Tiendas que comparamos": "Lojas que comparamos", "Ver más juegos": "Ver mais jogos",
    "Precio máximo": "Preço máximo", "Sin límite": "Sem limite", "Solo con stock": "Só com estoque", "Incluir marketplaces": "Incluir marketplaces", "Incluir particulares": "Incluir particulares", "Incluir juegos de importación": "Incluir jogos importados",
    "Claves vendidas por terceros (G2A, Eneba)": "Chaves vendidas por terceiros (G2A, Eneba)", "Segunda mano entre personas (Wallapop, eBay). Paga siempre por el envío protegido de la web.": "Usados entre pessoas (Wallapop, eBay). Pague sempre pelo envio protegido do site.",
    "Juegos en disco de otros países (UK, EE. UU., Japón…). Funcionan en consolas españolas, pero la caja o los textos pueden venir en otro idioma.": "Jogos em mídia física de outros países (Reino Unido, EUA, Japão…). Funcionam em consoles espanhóis, mas a caixa ou os textos podem vir em outro idioma.",
    "Listo": "Pronto", "Quitar filtros": "Limpar filtros", "No hay resultados": "Nenhum resultado", "Nada con estos filtros": "Nada com estes filtros", "Prueba a quitar alguno.": "Tente remover algum.", "Vuelve a probar en unos minutos.": "Tente novamente em alguns minutos.",
    "Buscando en todo el catálogo…": "Buscando em todo o catálogo…", "Un momento.": "Um momento.", "Cargando…": "Carregando…", "Edición especial": "Edição especial", "Edición": "Edição", "DLC": "DLC", "Tarjeta regalo": "Gift card", "Tarjeta": "Cartão",
    "Reserva": "Pré-venda", "Novedad": "Novidade", "Ahora no": "Agora não", "Ya a la venta": "Já à venda", "está a punto de salir": "está prestes a sair", "días": "dias", "horas": "horas", "min": "min", "Tiempo hasta el lanzamiento": "Tempo até o lançamento",
    "Precios orientativos · algunos enlaces son de afiliado": "Preços aproximados · alguns links são de afiliado", "Precios orientativos": "Preços aproximados", "algunos enlaces son de afiliado": "alguns links são de afiliado",
    "Historial y aviso de precio": "Histórico e alerta de preço", "Historial de precios y crear aviso por email": "Histórico de preços e alerta por e-mail", "Avisos por email": "Alertas por e-mail", "Confirmar": "Confirmar", "Guardando…": "Salvando…",
    "Aviso legal": "Aviso legal", "Condiciones de uso": "Termos de uso", "Privacidad": "Privacidade", "Cookies": "Cookies", "Configurar cookies": "Configurar cookies", "Información legal": "Informações legais", "Más información": "Mais informações",
    "Tu privacidad": "Sua privacidade", "Aceptar todo": "Aceitar tudo", "Rechazar todo": "Recusar tudo", "Configurar": "Configurar", "Guardar selección": "Salvar escolha", "Necesarias": "Necessárias", "Preferencias": "Preferências", "Tus datos": "Seus dados",
    "Solo guardan tu elección sobre cookies. Siempre activas.": "Só guardam sua escolha sobre cookies. Sempre ativas.", "Recuerdan tus filtros, tus búsquedas recientes y tus avisos de precio.": "Lembram seus filtros, suas buscas recentes e seus alertas de preço.",
    "Pillao no usa cookies de publicidad ni de analítica. Solo te pedimos permiso para recordar": "O Pillao não usa cookies de publicidade nem de análise. Só pedimos permissão para lembrar",
    "tus filtros, tus últimas búsquedas y tus avisos de precio": "seus filtros, suas últimas buscas e seus alertas de preço", "en este navegador.": "neste navegador.",
    "compara precios de videojuegos y no vende productos. Los precios son orientativos y se actualizan varias veces al día: el precio válido es siempre el de cada tienda. Algunos enlaces son de afiliado: si compras tras pulsarlos, la tienda puede pagarnos una pequeña comisión, sin coste para ti.": "compara preços de videogames e não vende produtos. Os preços são aproximados e atualizados várias vezes ao dia: o preço válido é sempre o de cada loja. Alguns links são de afiliado: se você comprar depois de clicar, a loja pode nos pagar uma pequena comissão, sem custo para você.",
    "Te avisamos de las bajadas de precio más fuertes en cuanto aparecen. Gratis y sin spam.": "Avisamos das maiores quedas de preço assim que aparecem. Grátis e sem spam.", "Unirme →": "Entrar →", "Telegram de ofertas: Pillao Chollos": "Ofertas no Telegram: Pillao Chollos",
    "Europa": "Europa", "Latinoamérica": "América Latina", "Precios en euros · claves de España, Europa y globales": "Preços em euros · chaves da Espanha, Europa e globais", "Precios en dólares · claves de Latinoamérica y globales": "Preços em dólares · chaves da América Latina e globais",
    "Elegido según el idioma de tu navegador. Puedes cambiarlo cuando quieras.": "Escolhido pelo idioma do seu navegador. Você pode mudar quando quiser.", "Elegido según el idioma de tu teléfono. Puedes cambiarlo cuando quieras.": "Escolhido pelo idioma do seu celular. Você pode mudar quando quiser.", "Idioma elegido por ti.": "Idioma escolhido por você.",
    "Confianza": "Confiança", "Tienda oficial": "Loja oficial", "Sin nota en Trustpilot": "Sem nota no Trustpilot", "Solo enlace de búsqueda": "Só link de busca", "Ver menos": "Ver menos", "Ver menos ▴": "Ver menos ▴", "¿o sorpresa?": "ou surpresa?",
    "Todas las tiendas": "Todas as lojas", "Con cupones": "Com cupons", "Sin cupones": "Sem cupons", "Cupones activos": "Cupons ativos", "Global": "Global", "Region free": "Region free", "válida en España": "válida na Espanha", "Importación": "Importado",
    "Parece que estás en Latinoamérica": "Parece que você está na América Latina", "Parece que estás en España o en Europa": "Parece que você está na Espanha ou na Europa", "Ver Latinoamérica": "Ver América Latina", "Ver Europa": "Ver Europa", "Quedarme aquí": "Ficar aqui",
    "Juego del Año": "Jogo do Ano"
  };
  // Español de Latinoamérica: casi todo igual; cambian algunas palabras
  var LAT = [[/\bEn disco\b/g, "Físico"], [/\ben disco\b/g, "físico"], [/\bDisco\b/g, "Físico"], [/\bordenador(es)?\b/g, "computadora$1"], [/\bOrdenador(es)?\b/g, "Computadora$1"], [/\bm[oó]vil(es)?\b/g, "celular$1"],
    [/\bMóvil(es)?\b/g, "Celular$1"], [/\bChollos de hoy\b/g, "Ofertas de hoy"], [/\bVer chollos\b/g, "Ver ofertas"], [/\bchollos\b/g, "ofertas"], [/\bChollos\b/g, "Ofertas"], [/\bRes[eé]rvalo\b/g, "Apártalo"], [/\bPVP\b/g, "Precio de lista"]];

  // Trozos con números o nombres dentro
  var REGLAS = {
    en: [[/^([\d.,]+) resultados?$/, "$1 results"], [/^([\d.,]+) juegos?$/, "$1 games"], [/^([\d.,]+) ofertas?$/, "$1 deals"], [/^([\d.,]+) skins?$/, "$1 skins"], [/^([\d.,]+) tarjetas? regalo$/, "$1 gift cards"], [/^([\d.,]+) programas?$/, "$1 programs"],
      [/^Desde$/, "From"], [/^sale el (.+)$/i, "out $1"], [/^Sale el jueves (\d+) de (\w+)$/, "Out Thursday, $2 $1"], [/^Clave (.+)$/, "$1 key"], [/^La clave más barata de (\d+) tiendas$/, "Cheapest key from $1 stores"],
      [/^Hasta el (.+)$/, "Until $1"], [/^hasta (.+)$/, "until $1"], [/^cesta máx\. (.+)$/, "max. basket $1"], [/^(\d+) usos? por persona$/, "$1 uses per person"], [/^Sin fecha de fin$/, "No end date"], [/^Precios de hace (\d+) h$/, "Prices from $1 h ago"],
      [/^Precios de hace (\d+) min$/, "Prices from $1 min ago"], [/^▾ (\d+) ofertas de (\d+) tiendas$/, "▾ $1 deals from $2 stores"], [/^▾ (\d+) opciones$/, "▾ $1 options"], [/^▾ (\d+) plataformas$/, "▾ $1 platforms"], [/^▾ (\d+) anuncios$/, "▾ $1 listings"],
      [/^\+(\d+) tiendas ▾$/, "+$1 stores ▾"], [/^\+(\d+) más ▾$/, "+$1 more ▾"], [/^Ver las (\d+) ofertas$/, "See all $1 deals"], [/^Ver las (\d+) tiendas$/, "See all $1 stores"], [/^(\d+) tiendas?$/, "$1 stores"], [/^\(quedan (\d+)\)$/, "($1 left)"],
      [/^Solo (.+)$/, "Only $1"], [/^(.+) ≈ en dólares$/, "$1 ≈ in USD"], [/^(\d+)ª mano$/, "$1nd hand"], [/^(\d+)ª mano desde$/, "Used from"], [/^(.+) envío$/, "$1 shipping"], [/^Envío (.+)$/, "Shipping $1"],
      [/^Valor (.+)$/, "Value $1"], [/^Te ahorras (.+)$/, "You save $1"], [/^Antes (.+)$/, "Was $1"], [/^Mejor (.+?) (\d{4})$/, "Best $1 $2"], [/^Nominado Juego del Año (\d+)$/, "Game of the Year nominee $1"], [/^🏆 Juego del Año (\d+)$/, "🏆 Game of the Year $1"],
      [/^Resérvalo donde esté más barato: comparamos (\d+) ofertas para (.+), en digital y en disco\.$/, "Pre-order it where it's cheapest: we compare $1 deals for $2, digital and physical."], [/^Ver las (\d+) ofertas$/, "See all $1 deals"],
      [/^(\d+) de 5 en Trustpilot \((.+) reseñas\)$/, "$1 out of 5 on Trustpilot ($2 reviews)"], [/^([\d.,]+) ofertas ahora$/, "$1 deals now"], [/^Europa$/, "Europe"]],
    pt: [[/^([\d.,]+) resultados?$/, "$1 resultados"], [/^([\d.,]+) juegos?$/, "$1 jogos"], [/^([\d.,]+) ofertas?$/, "$1 ofertas"], [/^([\d.,]+) skins?$/, "$1 skins"], [/^([\d.,]+) tarjetas? regalo$/, "$1 gift cards"], [/^([\d.,]+) programas?$/, "$1 programas"],
      [/^Desde$/, "A partir de"], [/^sale el (.+)$/i, "sai em $1"], [/^Sale el jueves (\d+) de (\w+)$/, "Sai na quinta-feira, $1 de $2"], [/^Clave (.+)$/, "Chave $1"], [/^La clave más barata de (\d+) tiendas$/, "A chave mais barata de $1 lojas"],
      [/^Hasta el (.+)$/, "Até $1"], [/^hasta (.+)$/, "até $1"], [/^cesta máx\. (.+)$/, "carrinho máx. $1"], [/^(\d+) usos? por persona$/, "$1 usos por pessoa"], [/^Sin fecha de fin$/, "Sem data de término"], [/^Precios de hace (\d+) h$/, "Preços de $1 h atrás"],
      [/^Precios de hace (\d+) min$/, "Preços de $1 min atrás"], [/^▾ (\d+) ofertas de (\d+) tiendas$/, "▾ $1 ofertas de $2 lojas"], [/^▾ (\d+) opciones$/, "▾ $1 opções"], [/^▾ (\d+) plataformas$/, "▾ $1 plataformas"], [/^▾ (\d+) anuncios$/, "▾ $1 anúncios"],
      [/^\+(\d+) tiendas ▾$/, "+$1 lojas ▾"], [/^\+(\d+) más ▾$/, "+$1 mais ▾"], [/^Ver las (\d+) ofertas$/, "Ver as $1 ofertas"], [/^Ver las (\d+) tiendas$/, "Ver as $1 lojas"], [/^(\d+) tiendas?$/, "$1 lojas"], [/^\(quedan (\d+)\)$/, "(restam $1)"],
      [/^Solo (.+)$/, "Somente $1"], [/^(.+) ≈ en dólares$/, "$1 ≈ em dólares"], [/^(\d+)ª mano$/, "Usado"], [/^(\d+)ª mano desde$/, "Usado a partir de"], [/^(.+) envío$/, "$1 de frete"], [/^Envío (.+)$/, "Frete $1"],
      [/^Valor (.+)$/, "Valor $1"], [/^Te ahorras (.+)$/, "Você economiza $1"], [/^Antes (.+)$/, "Antes $1"], [/^Mejor (.+?) (\d{4})$/, "Melhor $1 $2"], [/^Nominado Juego del Año (\d+)$/, "Indicado a Jogo do Ano $1"], [/^🏆 Juego del Año (\d+)$/, "🏆 Jogo do Ano $1"],
      [/^Resérvalo donde esté más barato: comparamos (\d+) ofertas para (.+), en digital y en disco\.$/, "Reserve onde estiver mais barato: comparamos $1 ofertas para $2, em digital e mídia física."],
      [/^(\d+) de 5 en Trustpilot \((.+) reseñas\)$/, "$1 de 5 no Trustpilot ($2 avaliações)"], [/^([\d.,]+) ofertas ahora$/, "$1 ofertas agora"]]
  };
  // Lo que nunca se traduce: nombres de juegos y de tiendas
  var NO = ".j-tit, .dest-lista b, .gta-ofs .t, .cuadro-tit, .pk-d b, .ti-nom, .t-nom, .of-t strong, .reg-idiomas b, [data-no-trad], script, style, svg, code, kbd";

  function trozo(t, l) {
    var dic = l === "en" ? EN : PT;
    if (dic[t]) return dic[t];
    var m = t.match(/^(\s*)([\s\S]*?)(\s*)$/), s = m[2];
    if (dic[s]) return m[1] + dic[s] + m[3];
    var r = REGLAS[l];
    for (var i = 0; i < r.length; i++) if (r[i][0].test(s)) return m[1] + fecha(l)(s.replace(r[i][0], r[i][1])) + m[3];
    return null;
  }
  function traducir(t, l) {
    if (!t || !/[A-Za-zÁÉÍÓÚáéíóúñÑ]/.test(t)) return t;
    if (l === "es-419") { var x = t; for (var i = 0; i < LAT.length; i++) x = x.replace(LAT[i][0], LAT[i][1]); return x; }
    var k = l === "en" ? "en" : "pt", entero = trozo(t, k);
    if (entero != null) return entero;
    if (t.indexOf(" · ") < 0) return t;
    return t.split(" · ").map(function (p) { var v = trozo(p, k); return v == null ? p : v; }).join(" · ");
  }
  var LANG = "es-ES", hechos = new WeakMap(), ATTR = ["placeholder", "aria-label", "title"];
  function nodoTexto(n) {
    var p = n.parentElement; if (!p || p.closest(NO)) return;
    var v = n.nodeValue, h = hechos.get(n);
    if (h && h.out === v) return;            // ya traducido por nosotros
    var nuevo = traducir(v, LANG);
    hechos.set(n, { out: nuevo });
    if (nuevo !== v) n.nodeValue = nuevo;
  }
  function elemento(e) {
    if (e.closest && e.closest(NO)) return;
    ATTR.forEach(function (a) { var v = e.getAttribute && e.getAttribute(a); if (v && e.dataset.trad !== a + v) { var t = traducir(v, LANG); if (t !== v) { e.setAttribute(a, t); } e.dataset.trad = a + t; } });
  }
  function recorrer(raiz) {
    if (raiz.nodeType === 3) return nodoTexto(raiz);
    if (raiz.nodeType !== 1) return;
    elemento(raiz);
    var w = document.createTreeWalker(raiz, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT), n;
    while ((n = w.nextNode())) { if (n.nodeType === 3) nodoTexto(n); else elemento(n); }
  }
  window.PILLAO_IDIOMA = function (l) {
    LANG = l;
    if (l === "es-ES") return;
    document.documentElement.lang = l === "en" ? "en" : l === "pt-BR" ? "pt-BR" : "es-419";
    recorrer(document.body);
    new MutationObserver(function (ms) {
      ms.forEach(function (m) {
        if (m.type === "characterData") nodoTexto(m.target);
        else if (m.type === "attributes") elemento(m.target);
        else m.addedNodes.forEach(recorrer);
      });
    }).observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTR });
  };
})();
