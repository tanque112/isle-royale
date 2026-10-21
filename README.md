# 🏝️ Isla Royale

Un **battle royale en 3D que funciona en el navegador**, hecho con JavaScript y [three.js](https://threejs.org/).
Saltas de un autobús volador sobre una isla con una ciudad de torres, buscas armas en el suelo y en cofres, rompes cosas con el pico para conseguir materiales, construyes, conduces motos por las carreteras y luchas contra bots (y contra tus amigos, en multijugador) hasta ser el último en pie.

> Proyecto fan inspirado en los juegos battle royale (como Fortnite). No está afiliado a Epic Games y no usa nada de sus recursos: todos los modelos, sonidos y nombres son propios.
> El estilo visual y las **medidas** (tamaño de las piezas de construcción, velocidades, estadísticas de las armas y curas) imitan las del **Capítulo 1 de Fortnite**, tomadas de la documentación de Epic y de la wiki de Fortnite. Las que no se conocen con exactitud están marcadas como "aprox." en `js/config.js`.

## ▶️ Cómo jugar

**En tu ordenador:** descarga la carpeta y haz doble clic en `index.html`. No hace falta instalar nada.
(Si tu navegador se queja, abre una terminal en la carpeta y ejecuta `python -m http.server`, luego entra en `http://localhost:8000`).

**En internet con GitHub Pages:** mira la sección [Subirlo a GitHub](#-subirlo-a-github).

### Controles

| Tecla | Acción |
|---|---|
| **WASD** | Moverse |
| **Ratón** | Mirar |
| **Clic izquierdo** | Disparar · golpear con el pico · usar una cura · colocar una pieza |
| **Clic derecho** | Apuntar (con el francotirador, mira telescópica) · en modo construcción, cambiar de material |
| **Espacio** | Saltar · saltar del autobús · abrir el planeador |
| **F** | Sacar el pico |
| **1-5** o rueda | Cambiar de hueco (armas y curas) |
| **Q** | Entrar / salir del modo construcción |
| **1 / 2 / 3 / 4** (construyendo) | Pared / Suelo / Rampa / Cono |
| **R** | Recargar · (construyendo) girar la rampa |
| **E** | Recoger arma o cura / abrir cofre / subir o bajar de la moto |
| **TAB** | Inventario |
| **Shift** | Correr (gasta energía: si corres mucho te cansas) |
| **C** | Agacharse (más precisión) |
| **V** | Cambiar entre primera y tercera persona |
| **M** | Mapa grande |
| **Esc** | Pausa |

La munición y los materiales se recogen solos al pasar por encima. Las armas y las curas se recogen con **E** (si ya llevas esa cura y cabe en el montón, también se coge sola).

## 🎮 Cómo funciona una partida

1. **Autobús:** cruza la isla volando. Pulsa **Espacio** cuando quieras saltar.
2. **Caída libre:** **mira hacia abajo** para caer en picado (mucho más rápido) y usa **WASD** para dirigirte. En picado se cae a 37 m/s. El planeador se abre solo a 100 m del suelo; si quieres abrirlo antes, pulsa **Espacio** otra vez (a partir de 1 segundo de caída y por debajo de 200 m). Planeando avanzas a 18,5 m/s.
3. **Botín:** empiezas **sólo con el pico**. Hay armas, munición, curas y materiales en el suelo y en **cofres** (los cofres dan mejores armas).
4. **Materiales:** golpea cosas con el pico para conseguir **madera** (árboles, muebles, casas de madera), **piedra** (rocas, edificios de ladrillo) y **metal** (coches, aires acondicionados).
5. **Construye** paredes, suelos, rampas y conos para cubrirte o subir alto.
6. **Tormenta:** una zona segura se va cerrando en 6 fases. Fuera de ella pierdes vida cada segundo.
7. **Cuidado con las caídas:** saltar desde más de unos 9 m de altura quita vida (5 por cada metro de más, directamente a la vida). Una caída de 4 plantas duele; una de 6, casi mata.
8. **Gana el último que quede vivo.** La isla es **siempre la misma** (así te aprendes los sitios); lo que cambia cada partida es el botín, la ruta del autobús y la tormenta.

### 🏃 Correr y cansarse

- Normalmente corres a **5,5 m/s**; esprintando (**Shift**) vas a **7,4 m/s** (las velocidades de Fortnite). Agachado vas a 4,2 m/s.
- Correr gasta la barra de **energía ⚡** (aparece encima de la vida): dura unos 6 segundos seguidos.
- Si se vacía estás **CANSADO**: vas más lento (4,6 m/s) y no puedes correr hasta que se recupere un poco (35 %).
- Cuando dejas de correr, la energía empieza a recuperarse al momento (menos de 1 s) y se llena del todo en unos 4 segundos.

## 🔫 Armas

Hay 4 armas y cada una usa **su propia munición**. Todas existen en 5 rarezas: cuanto más rara, más daño (y recarga un poco más rápido)… y más difícil de encontrar.

| Arma | Munición | Común | Poco común | Rara | Épica | Legendaria |
|---|---|---|---|---|---|---|
| Pistola | Balas ligeras | 23 | 24 | 25 | 26* | 27* |
| Fusil | Balas medias | 30 | 31 | 33 | 35 | 36 |
| Escopeta (10 perdigones) | Cartuchos | 85* | 90 | 95 | 100* | 105* |
| Francotirador | Balas pesadas | 95* | 100* | 105 | 110 | 116 |
| Fusil de ráfagas (tipo Famas, 3 balas por clic) | Balas medias | 27 | 29 | 30 | 32* | 33* |
| Escopeta táctica (10 perdigones, más rápida) | Cartuchos | 67 | 70 | 74 | 78* | 81* |
| Lanzamisiles (explota en 4 m, rompe construcciones) | Cohetes | — | — | 110 | 116 | 121 |

*(daño por disparo, con las cifras del Capítulo 1 de Fortnite; \* = esa rareza no existía en el Capítulo 1 y el valor sigue la misma progresión. Los disparos en la cabeza hacen más: ×2 pistola y fusil, ×2,5 escopeta y francotirador). Las balas también dañan paredes y construcciones.*

Cadencia, cargador y recarga también son los del Capítulo 1: el fusil dispara 5,5 balas/s con 30 balas por cargador, la escopeta 0,7 disparos/s con 5 cartuchos, la pistola 6,75 balas/s con 16 y el francotirador 0,33 disparos/s con 1 bala. Las armas tienen su tamaño real: fusil ~0,95 m, escopeta ~1,05 m, francotirador ~1,2 m, pistola ~0,25 m.

**Probabilidad de cada rareza:**

| | Común | Poco común | Rara | Épica | Legendaria |
|---|---|---|---|---|---|
| En el suelo | 46 % | 30 % | 15 % | 7 % | 2 % |
| En cofres | 16 % | 32 % | 29 % | 17 % | 6 % |

Además, las armas que más daño hacen por disparo aparecen menos: pistola 34 %, fusil 30 %, escopeta 24 %, francotirador 12 %.

**Pico:** 20 de daño a jugadores y 50 a estructuras, unos 2 golpes por segundo.

**Miras:**
- **Fusil y pistola:** cuatro rayitas que se abren cuando disparas o te mueves. Al **apuntar** (clic derecho) se cierran mucho.
- **Escopetas (la de corredera y la táctica):** un **cuadrado** pequeño: los perdigones caen dentro de él (la dispersión es cerrada, así que hay que apuntar bien).
- **Francotirador:** sin apuntar, sólo un punto. Al apuntar, **mira telescópica** con retícula y puntos para calcular la caída de la bala. El pulso tiembla un poco: mantén **Shift** para **aguantar la respiración** unos segundos y que tiemble mucho menos.

## ❤️ Vida, escudo y curas

- **Vida:** 100, empieza llena. **Escudo:** 100 como máximo, empieza a 0. El escudo absorbe el daño antes que la vida (la tormenta, en cambio, quita vida directamente).
- **Poción de escudo:** +50 de escudo, tarda 5 s (como en el Capítulo 1).
- **Botiquín:** cura la vida hasta 100, tarda 10 s.
- Las dos van **en los huecos del inventario** (se apilan hasta 3 por hueco). Selecciónalas con 1-5 y haz clic izquierdo para usarlas.

## 🧱 Construcción

- Pulsa **Q** y elige pieza: **1** pared, **2** suelo, **3** rampa, **4** cono. Verás una pieza azul (o roja si no se puede).
- **Clic izquierdo** coloca (mantén pulsado para construir seguido), **clic derecho** cambia de material, **R** gira la rampa.
- Las piezas miden lo mismo que en Fortnite: **5,12 × 5,12 m** de base y **3,84 m** de alto (las plantas de los edificios también miden 3,84 m). El personaje mide unos 1,85 m: más o menos media pared.
- Cada pieza cuesta **10** de material (puedes llevar hasta 999 de cada uno). La vida de la pieza depende del material: madera 150, piedra 300, metal 500. Las piezas recién puestas van ganando vida durante unos segundos (la madera es la más rápida).
- Las piezas tienen que apoyarse en el suelo o en otra construcción. Si rompes la base, lo que queda en el aire se derrumba.
- Casi todo lo del mapa se puede romper (paredes, suelos de los pisos, árboles, rocas, coches…). Lo único que **no** se rompe es el suelo del mapa (terreno, calles, aceras y la planta baja de los edificios), para que nunca te caigas de la isla.
- Las paredes, los suelos y los tejados de los edificios están hechos de **paneles de unos 4-5 m** (una ventana o puerta con su trozo de pared, o una baldosa de suelo): al picar o disparar sólo se rompe el panel que golpeas.
- **Tapar huecos:** si rompes un panel de pared de un edificio y apuntas al hueco con la **pared** (tecla 1), tu pared se ajusta **exactamente** a ese hueco, con la misma forma y tamaño. Lo mismo con el **suelo** (tecla 2) en un hueco del suelo o del tejado. Si alguien rompe tu pieza, el hueco vuelve a quedar libre para tapar otra vez.

## 🏍️ Motos

Hay unas 15 motos aparcadas por la isla: en las carreteras, en las calles de la ciudad y en los pueblos.

| Tecla | En la moto |
|---|---|
| **E** | Subir (junto a la moto) / bajar |
| **W** / **S** | Acelerar / frenar (y marcha atrás) |
| **A** / **D** | Girar |
| **Espacio** | Saltito |
| **Ratón** | Mirar alrededor (si no lo tocas, la cámara se vuelve a poner detrás) |

- Por **asfalto** (carreteras y ciudad) llega a **97 km/h**; por el campo, a 61 km/h. En el agua casi no avanza.
- Puedes subir por rampas (¡también las que construyes!) y salir volando.
- **Atropellar** a alguien le quita vida (más cuanto más rápido vas). **Estrellarte** contra una pared a más de 54 km/h o aterrizar desde muy alto te hace daño a ti.
- Montado no puedes disparar ni construir, pero te pueden disparar.

## 👥 Multijugador (con amigos)

1. Uno de vosotros pulsa **Crear partida** en el panel *Con amigos*. Le sale un **código de 5 letras** (por ejemplo `K7Q2M`): ese es el **anfitrión**.
2. Los demás escriben ese código y pulsan **Unirse** (hasta 8 jugadores en total). Poned vuestro nombre antes, para que se vea encima de vuestro personaje.
3. El anfitrión elige los bots y la dificultad y pulsa **JUGAR**: todos saltáis del mismo autobús, en la misma isla.
4. Al acabar, el anfitrión puede pulsar **Jugar otra vez** y empieza otra partida para todos.

**¿Cómo funciona?** Los navegadores se conectan directamente entre ellos con **WebRTC**. Para encontrarse usan un servidor público y gratuito de [PeerJS](https://peerjs.com) (`0.peerjs.com`), que sólo hace de "presentador": los datos de la partida van de un ordenador a otro. Por eso funciona igual en GitHub Pages, sin montar ningún servidor.

El **anfitrión** es el que manda: su ordenador mueve a los bots, reparte el botín, abre los cofres, decide qué se rompe y controla la tormenta. Cada jugador mueve a su propio personaje y le dice al anfitrión a quién ha disparado.

**Cosas a tener en cuenta**
- **Mientras los demás se unen, el anfitrión tiene que tener el juego abierto y EN PANTALLA.** Si lo minimiza o cambia de app (por ejemplo, para mandar el código por WhatsApp desde el móvil), el navegador "duerme" la pestaña y no puede contestar. Primero manda el código y luego vuelve al juego: el invitado lo reintenta solo durante casi un minuto.
- El anfitrión no debe cerrar el juego: si lo cierra, la partida se acaba para todos. En el ordenador, si cambia de pestaña durante la partida, el juego sigue funcionando (más despacio).
- Si sale **"La sala no existe"**: el código está mal o el anfitrión ha cerrado la sala.
- Si sale **"La sala existe, pero vuestras redes no dejan conectar"**: las dos redes no se pueden conectar directamente (pasa con algunas redes de móviles, institutos u oficinas). Probad con otra wifi, con datos o los dos en la misma wifi.
- Con muchos bots, que sea anfitrión el ordenador más potente.
- **Si no conecta:** mirad la línea "Versión del juego" bajo el panel *Con amigos*: **tiene que ser la misma en los dos ordenadores**. Si no lo es, el que tenga la antigua tiene que copiar la carpeta nueva del juego (o, si lo abrís desde una web, recargar con **Ctrl+F5**).
- **Para probarlo tú solo:** abre el juego con `?local` al final de la dirección (por ejemplo `index.html?local`) en **dos pestañas** del mismo navegador: una crea la partida y la otra se une. Así no se usa internet.

## 🗺️ Lugares de la isla

La isla mide unos **1,5 km** de lado a lado (la del Capítulo 1 medía unos 2,5 km) y tiene 29 lugares con nombre, todos unidos por carretera.

| Lugar | Cómo es |
|---|---|
| **Ciudad Torres** | La ciudad del centro y el sitio **principal** (donde más gente cae): torres de 2 a 6 plantas con escaleras, plaza con torre del reloj, parques y coches. |
| **Bahía Coral** | La segunda ciudad de la isla: en la orilla, 15 casitas de colores sobre pilotes, hotel, apartamentos, paseo de madera, chiringuito, heladería, mercadillo, vóley, torres de socorrista, **faro** (con cofre arriba) y muelle; y tierra adentro, un **centro urbano** con calles en cuadrícula, 11 manzanas de edificios de 2 a 5 plantas, coches aparcados y un paseo con palmeras y fuente. |
| **Pueblo Blanco** | Alrededor de la ciudad. Pueblo mediterráneo: casas encaladas con macetas, plaza con fuente y naranjos, capilla de cúpula azul con campanario y un molino de viento. |
| **Villa Polvo** | Alrededor de la ciudad. Pueblo del Oeste: calle de tierra con fachadas falsas, porches de madera, el saloon, depósito de agua, barriles, abrevadero y cactus. |
| **Polígono Acero** | Alrededor de la ciudad. Zona industrial: dos naves de chapa (con pasarela y escalera por dentro), contenedores apilados (cofre encima de uno), grúa torre, silos y chimenea. Buen sitio para conseguir **metal**. |
| **Fuerte Real** | Alrededor de la ciudad. Castillo con murallas almenadas por las que se puede andar (dos escaleras junto a la puerta), torres en las esquinas (cofre en una) y la torre del homenaje de 3 plantas en el centro. |
| **Villa Cumbre** | Pueblo en lo alto de una montaña: chalés de madera con tejados muy inclinados alrededor de una plaza con fuente, una ermita con campanario y un mirador con cofre. Se llega por carretera. |
| **Bosque Gigante** | Al otro lado de la isla: árboles de 20-30 m (dan mucha madera), un refugio de troncos y una cabaña en el claro. Algunos árboles tienen una **plataforma con cofre** a 5 m: ¡sube construyendo una rampa! |
| Granja Vieja, Pinar Alto, Puerto Brisa, Colina Seca, Playa Sol | Pueblos pequeños en la parte exterior de la isla: casas, granero, pinar, muelle, rocas y sombrillas. |
| Rancho Lomas, Cerro Rojo, Arboleda Fría, Prado Verde, Peñas Grises, Huerta Vieja, Pinar del Sur, Mirador Alto | Pueblos a medio camino entre la ciudad y la costa. |
| Valle Hondo, Cala Serena, Los Molinos, Puerto Viejo, Aldea Roble, Llano Alto, Monte Claro, Villa Sauce | Pueblos nuevos cerca de la costa. **Puerto Viejo, Llano Alto y Villa Sauce** son los más grandes (95 m de radio, unos 50 edificios, tres filas de casas por calle). |
| *Todos los pueblos de granja, bosque, puerto, colina, playa y aldea* | Pueblos grandes (70 m de radio): plaza con fuente, pozo o monumento, dos calles en cruz con farolas, casas mirando a la calle y tiendas o bares de 2-3 plantas junto a la plaza. Además: granero, silo y campos (granjas), aserradero y troncos (bosque), muelle (puerto), sombrillas (playa), torre mirador con cofre arriba (colina) o iglesia con campanario (aldea). |
| **Carreteras** | Una red de unas 33 carreteras (casi 7 km de asfalto) une la ciudad con todos los pueblos y los pueblos entre sí. Cada carretera sale de la ciudad por su propia calle y entra en los pueblos siguiendo una de sus calles hasta la plaza (en el mapa se ven las calles de los pueblos unidas a las carreteras). Ideales para ir en moto. |

### 🛋️ Interiores

Todos los edificios están amueblados y **ninguno es igual**: cada planta tiene habitaciones en las esquinas (con tabiques y su puerta) y muebles según el tipo de edificio, con colores distintos en cada casa.

| Edificio | Qué hay dentro |
|---|---|
| Casas, chalés | Salón con sofá, tele y alfombra · cocina con encimera, fuegos, fregadero y nevera · comedor · baño (váter, lavabo con espejo, bañera o ducha) · dormitorios (cama de matrimonio o individual, mesillas, armario, cómoda) · cuarto de niños con litera |
| Torres de la ciudad | Planta baja: recepción, tienda (estanterías con productos, mostrador, neveras de bebidas) o cafetería (barra con cafetera, vitrina de dulces, mesas). Arriba: pisos u oficinas (mesas con ordenador, archivadores, fuente de agua, sala de reuniones, despacho del jefe) |
| Hotel | Recepción con sofás y buzones; habitaciones con cama, tele, maletas y baño |
| Granero | Pacas de paja, banco de trabajo con herramientas, barriles, sacos; pajar arriba |
| Refugio y cabañas | Chimenea encendida, mesa larga con bancos, leña, trofeo en la pared, literas |
| Villa Polvo | Saloon (barra con botellas, taburetes, mesas, piano), tienda del Oeste (sacos, barriles) y oficina del sheriff con **calabozo de barrotes** y carteles de "se busca" |
| Capillas | Bancos en filas a los dos lados del pasillo, altar con velas |
| Fuerte Real | Gran salón con trono, mesas largas y estandartes · armería · alcoba con cama con dosel y baúl |

Los muebles hacen de cobertura y se pueden romper con el pico para sacar materiales (madera, piedra o metal según lo que sean). Nunca tapan la puerta ni el camino a las escaleras.

## 🛒 Taquilla y tienda

En el menú hay dos botones nuevos:

- **Tienda:** compra **skins** (31 de pago: gorros, cascos, máscaras, coronas, capas, alas, colas...) y **picos** (9: hacha, martillo, piruleta, guitarra, sable láser...). Sólo cambian el aspecto: todos los picos hacen el mismo daño.
- **Precio de las skins** según su rareza: común 800 🪙, poco común 1.200, rara 1.800, épica 2.500 y legendaria 3.500.
- **Taquilla:** equipa lo que ya tienes. Se ve en 3D antes de elegir.
- **Monedas 🪙:** empiezas con 600 y ganas más al acabar cada partida (por quedar bien, por cada eliminación y un extra si ganas). Se guardan en tu cuenta (o en el navegador, si juegas como invitado).
- Los bots también llevan skins y picos de la tienda, y en multijugador cada uno ve la skin de los demás.

## 👤 Cuentas, rangos y rankings

Arriba del menú está la **barra de tu cuenta**. Pulsa **Crear cuenta** (nombre de 3 a 14 letras/números/_ y contraseña de 6 caracteres o más) o **Entrar**.

- Tu cuenta guarda **tus monedas, lo que tienes en la taquilla y tus estadísticas** (partidas, victorias, bajas, top 10, daño, tiempo vivo, récord de bajas y rango). Al crearla, lo que tenías como invitado pasa a la cuenta.
- En multijugador se usa el nombre de tu cuenta.
- Sin cuenta se juega como **invitado**: las monedas se guardan en el navegador, pero no tienes rango ni sales en los rankings.

**🏆 Rankings** (botón en la barra de la cuenta), con tres pestañas: **Bajas**, **Victorias** y **Rango**.

**🏅 Rangos:** Bronce, Plata, Oro, Platino y Diamante (cada uno con divisiones I, II y III), y después Élite, As y Unreal. Cada partida da o quita **puntos de rango (RP)**:

| | RP |
|---|---|
| Ganar | +60 |
| Top 10 % / 25 % / 50 % | +30 / +15 / +4 |
| Caer en la mitad de abajo | −12 |
| Entre los primeros en caer | −28 |
| Cada baja | de +8 a +22 (vale más cuanta menos gente queda viva) |

Cuanto más alto es tu rango, más pierdes por caer pronto y menos ganas por el puesto. Lo ganado se multiplica ×0,6 con bots en fácil y ×1,35 en difícil, y se reduce si hay pocos jugadores en la partida (máximo +350 por partida). **Salir de una partida a medias cuenta como eliminado.** Todos estos números están en `G.RANKED`, en `js/config.js`.

**¿Dónde se guardan las cuentas?**
- **Por defecto, en el navegador:** funciona sin configurar nada, pero los rankings sólo muestran las cuentas creadas en ese ordenador.
- **Online, con Firebase (gratis, sin montar servidor):** sigue los pasos de `js/online.js` y pega las reglas de `firestore.rules`. Así todo el que juegue a tu juego (por ejemplo en GitHub Pages) comparte cuentas y rankings, y puede entrar desde cualquier ordenador.

> Ojo: el juego se ejecuta en el navegador de cada jugador, así que alguien que sepa programar podría hacer trampas con sus estadísticas. Las reglas de `firestore.rules` limitan cuánto puede cambiar una ficha en cada guardado (por ejemplo, no más de 100 bajas ni 400 RP de golpe), pero no lo impiden del todo.

## 🎒 Inventario (TAB)

Al pulsar **TAB** se abre el inventario, donde puedes:
- Ver el pico y tus 5 huecos con sus estadísticas (daño, cadencia, recarga…).
- **Ordenar las armas arrastrándolas** de un hueco a otro (o con los botones Mover). Si juntas dos curas iguales se apilan.
- Equipar o tirar un objeto.
- Ver toda tu **munición**, tus **materiales** (madera, piedra, metal) y tu salud.

## 🤖 Los bots

Cada bot elige dónde caer, busca botín y cofres, sube escaleras, huye de la tormenta, se cura con pociones y botiquines y pelea contra ti y contra otros bots. Si les bloqueas el paso con una pared, la rompen con el pico, y si te escondes detrás de una construcción, la acribillan. También se cansan si corren mucho y les afecta el daño de caída.

- **Construyen:** pican árboles, rocas, cajas y coches para tener materiales; se ponen un **muro** delante si les disparan en campo abierto, suben con **rampas** hacia un enemigo que está más alto, se meten en una **caja de paredes** para curarse (y a veces en las zonas finales) y ponen una rampa si se atascan en un desnivel. Cuanto más difícil, más construyen.
- **Se mueven mejor:** cortan camino en línea recta cuando pueden, rodean los obstáculos, esprintan en los trayectos largos y en las peleas cercanas saltan y se mueven de lado; si les queda poca vida, se alejan.
- **Se pelean entre ellos:** van hacia los disparos que oyen y, desde la tercera zona, se buscan unos a otros. Con 100 bots suelen llegar unos 15 a la tercera zona (antes llegaban unos 50 y sólo iban a por ti).

En el menú eliges la dificultad y **cuántos bots: 10, 20, 30, 50, 75 o 100**. Con muchos bots aparece más botín para que haya armas para todos, y más bots caen repartidos por la isla. Para 75 o 100 bots se recomienda un ordenador potente (los personajes lejanos se dibujan con un modelo simplificado para que vaya fluido).

## ⚡ Rendimiento

El juego está pensado para funcionar en casi cualquier ordenador:
- **Gráficos Bajos / Medios / Altos** en el menú (Medios es el recomendado; Altos añade sombras reales y bordes suaves).
- **Resolución automática:** si el juego va a menos de 40 FPS, baja un poco la resolución él solo, y la vuelve a subir cuando sobra potencia. Puedes activar **Mostrar FPS** para verlo.
- La ciudad entera se dibuja en pocas "llamadas" a la tarjeta gráfica, los personajes lejanos se dibujan con una sola pieza (o no se dibujan si están muy lejos) y la IA de los bots es ligera (con 100 bots la simulación entera tarda alrededor de 1-2 ms por fotograma).

Si notas que el ratón deja de mover la cámara, haz clic dentro del juego: el navegador sólo "captura" el ratón después de un clic, y tras pulsar Esc tarda un segundo en dejar volver a capturarlo.

## 📁 Qué hace cada archivo

```
isla-royale/
├── index.html        → la página: el HUD, los menús, el inventario y el orden de carga de los scripts
├── firestore.rules   → (opcional) reglas de la base de datos online de cuentas (ver js/online.js)
├── css/style.css     → el aspecto de la interfaz
├── lib/three.min.js  → la librería 3D three.js (r149)
└── js/
    ├── config.js     → TODOS los números del juego (armas, rarezas, curas, materiales, tormenta…)
    ├── utils.js      → matemáticas, números aleatorios, ruido y el "GeoBuilder" que junta cajas en una malla
    ├── style.js      → el aspecto visual: paleta, corrección de color, cielo con sol, nubes esponjosas y muro de la tormenta
    ├── physics.js    → colisiones con paredes, suelo, escaleras y rampas, y rayos (balas, línea de visión)
    ├── audio.js      → sonidos generados por código (Web Audio API)
    ├── models.js     → modelos 3D: personajes, armas, pico, curas, cofres, piezas de construcción, autobús
    ├── nav.js        → red de caminos para que los bots no atraviesen paredes (algoritmo A*)
    ├── destruct.js   → todo lo que se puede romper: vida, materiales y cómo desaparece
    ├── world.js      → genera la isla, la ciudad con edificios de varias plantas, los pueblos y los árboles
    ├── roads.js      → las carreteras: el trazado, aplanar el terreno y dibujar el asfalto
    ├── decor.js      → adornos de fachadas y tejados, vallas publicitarias, farolas y semáforos, y los coches
    ├── towns.js      → los pueblos alrededor de la ciudad (Pueblo Blanco, Villa Polvo, Polígono Acero, Fuerte Real) y el faro
    ├── interiors.js  → los interiores: habitaciones con tabiques y más de 50 muebles distintos según el tipo de edificio
    ├── effects.js    → trazadoras de bala, chispas, escombros, fogonazos
    ├── loot.js       → el botín del suelo y los cofres
    ├── character.js  → la clase Character (vida, escudo, inventario, curas, movimiento, animación)
    ├── combat.js     → disparar, el pico, dispersión, daño por distancia, escudo y bajas
    ├── build.js      → el sistema de construcción (cuadrícula, piezas, huecos, derrumbes)
    ├── vehicles.js   → las motos (física, atropellos, choques)
    ├── player.js     → teclado/ratón, la cámara del jugador y el modo construcción
    ├── bots.js       → la inteligencia artificial de los bots
    ├── bus.js        → el autobús volador
    ├── storm.js      → la tormenta que se cierra
    ├── net.js        → el multijugador (salas con código, WebRTC y sincronizar la partida)
    ├── hud.js        → barras de vida/escudo, barra de objetos, inventario TAB, minimapa, números de daño
    ├── shop.js       → taquilla y tienda: skins, picos, monedas y la vista previa en 3D
    ├── account.js    → cuentas, estadísticas, rangos (RP) y rankings
    ├── online.js     → (opcional) la configuración de Firebase para cuentas y rankings online
    └── game.js       → el bucle principal, la calidad gráfica y el flujo de la partida
```

**¿Quieres otra isla?** Cambia `mapSeed` en `js/config.js` (o abre el juego con `?seed=123` al final de la dirección para probar una).

**¿Quieres cambiar algo?** Empieza por `js/config.js`: ahí puedes subir el daño de un arma, hacer que las pociones den 75 de escudo, cambiar lo que cuesta construir o la vida de cada material, o hacer la tormenta más lenta.

## 🚀 Subirlo a GitHub

1. Crea un repositorio nuevo en [github.com/new](https://github.com/new) (por ejemplo `isla-royale`), público.
2. Sube los archivos:
   - **Sin terminal:** en el repositorio pulsa *Add file → Upload files* y arrastra **el contenido** de la carpeta (`index.html`, `README.md`, y las carpetas `css`, `js` y `lib`). Pulsa *Commit changes*.
   - **Con terminal:**
     ```bash
     cd isla-royale
     git init
     git add .
     git commit -m "Isla Royale"
     git branch -M main
     git remote add origin https://github.com/TU_USUARIO/isla-royale.git
     git push -u origin main
     ```
3. Activa **GitHub Pages:** *Settings → Pages → Build and deployment → Source: Deploy from a branch → Branch: `main` / `(root)` → Save*.
4. En un par de minutos tu juego estará en `https://TU_USUARIO.github.io/isla-royale/`.

Si ya lo tenías subido, sustituye los archivos por los nuevos (los de `js/`, `css/style.css` e `index.html`) y haz otro commit.

## 🧰 Requisitos

Un navegador moderno de ordenador (Chrome, Edge, Firefox) con WebGL. Se juega con teclado y ratón (en móvil no funciona). Para el multijugador hace falta conexión a internet.

## 📜 Créditos

- [three.js](https://threejs.org/) (licencia MIT) para el 3D.
- El servidor público de señalización de [PeerJS](https://peerjs.com) para que los jugadores se encuentren en multijugador, y su librería oficial ([`lib/peerjs.min.js`](lib/peerjs.min.js), versión 1.5.4, licencia MIT): el servidor público sólo acepta conexiones hechas con ella.
- Fuentes de Google Fonts: *Luckiest Guy* y *Rubik*.
- Todo lo demás (código, modelos, sonidos) está hecho para este proyecto.
