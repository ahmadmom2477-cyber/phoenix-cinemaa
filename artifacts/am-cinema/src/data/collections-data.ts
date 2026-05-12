export interface Collection {
  id: string;
  nameEn: string;
  nameAr: string;
  icon: string;
  color: string;
  imdbIds: string[];
}

export const COLLECTIONS: Collection[] = [
  {
    id: "mcu",
    nameEn: "Marvel Cinematic Universe",
    nameAr: "عالم مارفل السينمائي",
    icon: "🦸",
    color: "from-red-900/40 to-red-700/10",
    imdbIds: [
      "tt0371746", // Iron Man
      "tt0800080", // The Incredible Hulk
      "tt1228705", // Iron Man 2
      "tt0458339", // Thor
      "tt1300854", // Captain America: The First Avenger
      "tt0848228", // The Avengers
      "tt1843866", // Captain America: The Winter Soldier
      "tt1981115", // Thor: The Dark World
      "tt2395427", // Avengers: Age of Ultron
      "tt2709692", // Ant-Man
      "tt3498820", // Captain America: Civil War
      "tt1211837", // Doctor Strange
      "tt2015381", // Guardians of the Galaxy
      "tt3896198", // Guardians of the Galaxy Vol. 2
      "tt3501632", // Thor: Ragnarok
      "tt4154756", // Avengers: Infinity War
      "tt4154796", // Avengers: Endgame
      "tt5095030", // Black Panther
      "tt9419884", // Black Widow
      "tt9376612", // Shang-Chi
      "tt9032400", // Eternals
      "tt10648342", // Thor: Love and Thunder
      "tt6320628", // Doctor Strange in the MoM
    ],
  },
  {
    id: "dc",
    nameEn: "DC Universe",
    nameAr: "عالم DC",
    icon: "🦇",
    color: "from-blue-900/40 to-blue-700/10",
    imdbIds: [
      "tt0372784", // Batman Begins
      "tt0468569", // The Dark Knight
      "tt1345836", // The Dark Knight Rises
      "tt1477834", // Man of Steel
      "tt2975590", // Batman v Superman
      "tt1846589", // Wonder Woman
      "tt3385516", // Justice League
      "tt4116284", // Suicide Squad
      "tt5463162", // Aquaman
      "tt6274384", // Wonder Woman 1984
      "tt7126948", // Shazam!
      "tt11080016", // The Suicide Squad
      "tt1877830", // The Batman (2022)
    ],
  },
  {
    id: "fastandfurious",
    nameEn: "Fast & Furious",
    nameAr: "السرعة والغضب",
    icon: "🚗",
    color: "from-orange-900/40 to-orange-700/10",
    imdbIds: [
      "tt0232500", // The Fast and the Furious
      "tt0322259", // 2 Fast 2 Furious
      "tt0463985", // Tokyo Drift
      "tt1013752", // Fast & Furious
      "tt1596343", // Fast Five
      "tt1905041", // Fast & Furious 6
      "tt2820852", // Furious 7
      "tt4630562", // The Fate of the Furious
      "tt5433138", // Hobbs & Shaw
      "tt7286456", // F9
      "tt8790086", // Fast X
    ],
  },
  {
    id: "harrypotter",
    nameEn: "Harry Potter",
    nameAr: "هاري بوتر",
    icon: "🧙",
    color: "from-purple-900/40 to-purple-700/10",
    imdbIds: [
      "tt0241527", // Sorcerer's Stone
      "tt0295297", // Chamber of Secrets
      "tt0304141", // Prisoner of Azkaban
      "tt0330373", // Goblet of Fire
      "tt0373889", // Order of the Phoenix
      "tt0417741", // Half-Blood Prince
      "tt0926084", // Deathly Hallows Part 1
      "tt1201607", // Deathly Hallows Part 2
      "tt4123430", // Fantastic Beasts
      "tt4123432", // Fantastic Beasts: Crimes of Grindelwald
      "tt6472976", // Fantastic Beasts: Secrets of Dumbledore
    ],
  },
  {
    id: "starwars",
    nameEn: "Star Wars",
    nameAr: "حرب النجوم",
    icon: "⚔️",
    color: "from-yellow-900/40 to-yellow-700/10",
    imdbIds: [
      "tt0076759", // A New Hope
      "tt0080684", // The Empire Strikes Back
      "tt0086190", // Return of the Jedi
      "tt0120915", // The Phantom Menace
      "tt0121765", // Attack of the Clones
      "tt0121766", // Revenge of the Sith
      "tt2488496", // The Force Awakens
      "tt3748528", // Rogue One
      "tt2527336", // The Last Jedi
      "tt3778644", // Solo
      "tt2527338", // The Rise of Skywalker
    ],
  },
  {
    id: "lotr",
    nameEn: "Lord of the Rings",
    nameAr: "سيد الخواتم",
    icon: "💍",
    color: "from-emerald-900/40 to-emerald-700/10",
    imdbIds: [
      "tt0120737", // The Fellowship of the Ring
      "tt0167261", // The Two Towers
      "tt0167260", // The Return of the King
      "tt0903624", // The Hobbit: An Unexpected Journey
      "tt1170358", // The Hobbit: The Desolation of Smaug
      "tt2310332", // The Hobbit: The Battle of the Five Armies
    ],
  },
  {
    id: "johnwick",
    nameEn: "John Wick",
    nameAr: "جون ويك",
    icon: "🔫",
    color: "from-zinc-900/40 to-zinc-700/10",
    imdbIds: [
      "tt2911666", // John Wick
      "tt4425200", // John Wick: Chapter 2
      "tt6146586", // John Wick: Chapter 3
      "tt10366206", // John Wick: Chapter 4
    ],
  },
  {
    id: "missionimpossible",
    nameEn: "Mission: Impossible",
    nameAr: "مهمة مستحيلة",
    icon: "💣",
    color: "from-sky-900/40 to-sky-700/10",
    imdbIds: [
      "tt0117060", // Mission: Impossible (1996)
      "tt0120912", // Mission: Impossible 2
      "tt0317919", // Mission: Impossible III
      "tt1229238", // Ghost Protocol
      "tt2381249", // Rogue Nation
      "tt4912910", // Fallout
      "tt7764882", // Dead Reckoning Part One
    ],
  },
  {
    id: "matrix",
    nameEn: "The Matrix",
    nameAr: "ماتريكس",
    icon: "🟩",
    color: "from-green-900/40 to-green-700/10",
    imdbIds: [
      "tt0133093", // The Matrix
      "tt0234215", // The Matrix Reloaded
      "tt0242653", // The Matrix Revolutions
      "tt10838180", // The Matrix Resurrections
    ],
  },
  {
    id: "jamesbond",
    nameEn: "James Bond",
    nameAr: "جيمس بوند",
    icon: "🎰",
    color: "from-slate-900/40 to-slate-700/10",
    imdbIds: [
      "tt0381061", // Casino Royale (2006)
      "tt0830515", // Quantum of Solace
      "tt1074638", // Skyfall
      "tt2379713", // Spectre
      "tt2382320", // No Time to Die
    ],
  },
  {
    id: "jurassicpark",
    nameEn: "Jurassic Park",
    nameAr: "حديقة الديناصورات",
    icon: "🦕",
    color: "from-lime-900/40 to-lime-700/10",
    imdbIds: [
      "tt0107290", // Jurassic Park
      "tt0119567", // The Lost World: Jurassic Park
      "tt0369610", // Jurassic Park III... wait
      "tt4881806", // Jurassic World
      "tt8041270", // Jurassic World: Fallen Kingdom
      "tt10298810", // Jurassic World: Dominion
    ],
  },
  {
    id: "piratesofthecaribbean",
    nameEn: "Pirates of the Caribbean",
    nameAr: "قراصنة الكاريبي",
    icon: "🏴‍☠️",
    color: "from-teal-900/40 to-teal-700/10",
    imdbIds: [
      "tt0325980", // The Curse of the Black Pearl
      "tt0383574", // Dead Man's Chest
      "tt0449088", // At World's End
      "tt1298650", // On Stranger Tides
      "tt1790809", // Dead Men Tell No Tales
    ],
  },
  {
    id: "indianajones",
    nameEn: "Indiana Jones",
    nameAr: "إنديانا جونز",
    icon: "🎩",
    color: "from-amber-900/40 to-amber-700/10",
    imdbIds: [
      "tt0082971", // Raiders of the Lost Ark
      "tt0087469", // Temple of Doom
      "tt0097576", // The Last Crusade
      "tt0367882", // Kingdom of the Crystal Skull
      "tt7648802", // Dial of Destiny
    ],
  },
  {
    id: "terminator",
    nameEn: "Terminator",
    nameAr: "المُنهي",
    icon: "🤖",
    color: "from-red-950/40 to-zinc-900/40",
    imdbIds: [
      "tt0088247", // The Terminator
      "tt0103064", // Terminator 2: Judgment Day
      "tt0181852", // Terminator 3
      "tt0438488", // Terminator Salvation
      "tt1340138", // Terminator Genisys
      "tt1612774", // Terminator: Dark Fate
    ],
  },
  {
    id: "spiderman",
    nameEn: "Spider-Man",
    nameAr: "الرجل العنكبوت",
    icon: "🕷️",
    color: "from-red-900/40 to-blue-900/20",
    imdbIds: [
      "tt0145487", // Spider-Man (2002)
      "tt0316654", // Spider-Man 2
      "tt0413300", // Spider-Man 3
      "tt0948470", // The Amazing Spider-Man
      "tt1872181", // The Amazing Spider-Man 2
      "tt2250912", // Spider-Man: Homecoming
      "tt6320628", // Spider-Man: Far From Home
      "tt10872600", // Spider-Man: No Way Home
    ],
  },
  {
    id: "xmen",
    nameEn: "X-Men",
    nameAr: "إكس-مين",
    icon: "🧬",
    color: "from-yellow-900/40 to-blue-900/20",
    imdbIds: [
      "tt0120903", // X-Men
      "tt0290334", // X2: X-Men United
      "tt0376994", // X-Men: The Last Stand
      "tt0376994", // keep only unique
      "tt1270798", // X-Men: First Class
      "tt1341167", // The Wolverine
      "tt1877832", // X-Men: Days of Future Past
      "tt3385516", // X-Men: Apocalypse
      "tt4682266", // Logan
      "tt6565702", // Dark Phoenix
    ],
  },
  {
    id: "alien",
    nameEn: "Alien",
    nameAr: "كائن فضائي",
    icon: "👾",
    color: "from-stone-900/40 to-stone-700/10",
    imdbIds: [
      "tt0078748", // Alien (1979)
      "tt0090605", // Aliens (1986)
      "tt0118115", // Alien 3
      "tt0120892", // Alien: Resurrection
      "tt1446714", // Prometheus
      "tt3278244", // Alien: Covenant
    ],
  },
  {
    id: "conjuring",
    nameEn: "The Conjuring Universe",
    nameAr: "عالم الاستدعاء",
    icon: "👻",
    color: "from-neutral-900/40 to-neutral-700/10",
    imdbIds: [
      "tt1457767", // The Conjuring
      "tt2832452", // The Conjuring 2
      "tt5340252", // The Conjuring: The Devil Made Me Do It
      "tt2626232", // Annabelle
      "tt4513316", // Annabelle: Creation
      "tt4686464", // The Nun
      "tt5780836", // The Curse of La Llorona
      "tt7069210", // Annabelle Comes Home
    ],
  },
  {
    id: "rockycreed",
    nameEn: "Rocky & Creed",
    nameAr: "روكي وكريد",
    icon: "🥊",
    color: "from-red-900/40 to-yellow-900/20",
    imdbIds: [
      "tt0075148", // Rocky
      "tt0079663", // Rocky II
      "tt0084602", // Rocky III
      "tt0089927", // Rocky IV
      "tt0100507", // Rocky V
      "tt0416449", // Rocky Balboa
      "tt3076658", // Creed
      "tt6343314", // Creed II
      "tt11145118", // Creed III
    ],
  },
  {
    id: "hunggergames",
    nameEn: "The Hunger Games",
    nameAr: "ألعاب الجوع",
    icon: "🏹",
    color: "from-orange-900/40 to-yellow-900/20",
    imdbIds: [
      "tt1392170", // The Hunger Games
      "tt1951264", // Catching Fire
      "tt2637294", // Mockingjay Part 1
      "tt2637310", // Mockingjay Part 2
      "tt10545296", // The Ballad of Songbirds & Snakes
    ],
  },
  {
    id: "transformers",
    nameEn: "Transformers",
    nameAr: "المحولون",
    icon: "⚙️",
    color: "from-yellow-900/40 to-gray-900/40",
    imdbIds: [
      "tt0418279", // Transformers (2007)
      "tt0961097", // Revenge of the Fallen
      "tt1399103", // Dark of the Moon
      "tt1546849", // Age of Extinction
      "tt3794354", // The Last Knight
      "tt3890160", // Bumblebee
      "tt5177088", // Rise of the Beasts
    ],
  },
  {
    id: "shrek",
    nameEn: "Shrek",
    nameAr: "شريك",
    icon: "🧅",
    color: "from-green-900/40 to-yellow-900/20",
    imdbIds: [
      "tt0126029", // Shrek
      "tt0298148", // Shrek 2
      "tt0413267", // Shrek the Third
      "tt0892791", // Shrek Forever After
    ],
  },
  {
    id: "despicableme",
    nameEn: "Despicable Me",
    nameAr: "أنا الشرير",
    icon: "💛",
    color: "from-yellow-900/40 to-purple-900/20",
    imdbIds: [
      "tt1323594", // Despicable Me
      "tt1690953", // Despicable Me 2
      "tt2293640", // Minions
      "tt3469046", // Despicable Me 3
      "tt5113044", // Minions: The Rise of Gru
      "tt7510222", // Despicable Me 4
    ],
  },
  {
    id: "nolan",
    nameEn: "Christopher Nolan",
    nameAr: "أفلام كريستوفر نولان",
    icon: "🎬",
    color: "from-indigo-900/40 to-indigo-700/10",
    imdbIds: [
      "tt0209144", // Memento
      "tt0372784", // Batman Begins
      "tt0468569", // The Dark Knight
      "tt1375666", // Inception
      "tt0816692", // Interstellar
      "tt1345836", // The Dark Knight Rises
      "tt5013056", // Dunkirk
      "tt6723592", // Tenet
      "tt11286314", // Oppenheimer
    ],
  },
  {
    id: "kingsman",
    nameEn: "Kingsman",
    nameAr: "كينغسمان",
    icon: "🎩",
    color: "from-violet-900/40 to-violet-700/10",
    imdbIds: [
      "tt2802144", // Kingsman: The Secret Service
      "tt4649466", // Kingsman: The Golden Circle
      "tt6856242", // The King's Man
    ],
  },
  {
    id: "madmax",
    nameEn: "Mad Max",
    nameAr: "ماكس المجنون",
    icon: "🏜️",
    color: "from-orange-900/40 to-stone-900/40",
    imdbIds: [
      "tt0077651", // Mad Max
      "tt0082694", // Mad Max 2: The Road Warrior
      "tt0083869", // Mad Max Beyond Thunderdome
      "tt1392190", // Mad Max: Fury Road
      "tt9603212", // Furiosa
    ],
  },
];
