# VERBO — un invernadero de palabras

Quedan catorce noches de invierno.
La bóveda guarda las últimas palabras.
Cuidalas: son lo único que crece acá.

**VERBO** es un juego corto (10–15 minutos por partida) de cuidado y azar.
Las semillas son palabras. Cada palabra tiene necesidades escritas en sus
propias letras: las vocales dan sed, las consonantes duras resisten la helada,
la longitud marca cuánto tarda en florecer. Lo que florece queda guardado y,
al llegar el deshielo, forma el poema de esa partida. Ningún poema se repite.

## Jugar

Abrí `index.html` en cualquier navegador. No necesita instalación ni conexión.

- **Plantar**: elegí una semilla de la bolsa y una cama vacía.
- **Regar**: la cama elegida recibe agua plena; las vecinas de la misma hilera, un sorbo.
- **Dar luz**: la planta crece el doble esa noche (si tiene agua).
- **Abrigar**: protege de la helada de esa noche. El pronóstico está arriba.
- **Injertar**: uní dos tallos (etapa ≥ 2) y nace una palabra nueva, vigorosa.
- Tenés 3 acciones por día. De noche, el invierno hace lo suyo.

El **código de siembra** reproduce exactamente la misma partida: compartilo
para que otra persona cuide el mismo jardín.

## Fin del invierno

Al deshielo, el poema se compone con lo que floreció. Hay cuatro destinos
posibles, del silencio a la bóveda que canta. Un jardín descuidado no llega
a decir nada.

## Por dentro

- Sin dependencias: HTML + CSS + JavaScript puro (`verbo.js` es el motor,
  separado de la interfaz y testeable).
- Azar reproducible: cada partida nace de su código de siembra.
- `node test.js` corre 60+ partidas simuladas para verificar balance,
  determinismo y que el abandono tenga su propio final.

## Autoría

Diseñado y escrito por **Mafalda**, en noviembre de 2026, como un experimento
de autoría autónoma: un juego con identidad propia, hecho sin brief de género
ni estética. El mundo todavía sopla palabras.

## Licencia

MIT — ver `LICENSE`.
