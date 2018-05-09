const sqlite = require('sqlite'),
      Sequelize = require('sequelize'),
      request = require('request'),
      express = require('express'),
      app = express();

const { PORT=3000, NODE_ENV='development', DB_PATH='./db/database.db' } = process.env;

const sequelize = new Sequelize(process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASSWORD, {
	host: process.env.DB_HOST,
	dialect: 'sqlite',
	storage: './db/database.db'
});

sequelize
  .authenticate()
  .then(() => {
     console.log('CONNECTED TO DB');
  })
  .catch(err => {
    console.error('ERROR IN CONNECTING TO DB ->', err);
  });

// MODELS
const FILMS = sequelize.define('film', {
  id: {
    type: Sequelize.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  title: {
    type: Sequelize.STRING
  },
  release_date: {
    type: Sequelize.DATEONLY
  },
  tagline: {
    type: Sequelize.STRING
  },
  revenue: {
    type: Sequelize.INTEGER
  },
  budget: {
    type: Sequelize.INTEGER
  },
  runtime: {
    type: Sequelize.INTEGER
  },
  original_language: {
    type: Sequelize.STRING
  },
  status: {
    type: Sequelize.STRING
  },
  genre_id: {
    type: Sequelize.INTEGER
  }
}, {
    underscored: true,
    timestamps: false
});

const GENRES = sequelize.define('genre', {
  id: {
    type: Sequelize.INTEGER,
    primaryKey: true,
     autoIncrement: true
  },
  name: {
    type: Sequelize.STRING
  }
}, {
    underscored: true,
    timestamps: false
  });

FILMS.belongsTo(GENRES, {
	foreignKey: 'genre_id'
});

// START SERVER
Promise.resolve()
  .then(() => app.listen(PORT, () => console.log(`App listening on port ${PORT}`)))
  .catch((err) => { if (NODE_ENV === 'development') console.error(err.stack); });

// ROUTES
app.get('/films/:id/recommendations', getFilmRecommendations);
app.get('*', function(req, res){
	res.status(404).json({
		message: '"message" key missing'
	})
});

// ROUTE HANDLER
function getFilmRecommendations(req, res) {
  if (isNaN(parseInt(req.params.id))) {
    res.status(422).json({
      message: '"message" key missing'
    });
  }

  let limit = 10;
  if (req.query.limit) {
    if (isNaN(parseInt(req.query.limit))) {
      res.status(422).json({
        message: '"message" key missing'
      });
    }
    limit = parseInt(req.query.limit);
  }

  let offset = 0;
  if (req.query.offset) {
    if (isNaN(parseInt(req.query.offset))) {
      res.status(422).json({
        message: '"message" key missing'
      });
    }

    offset = parseInt(req.query.offset);
  }
  
  FILMS.findById(req.params.id)
  	.then( film => {
  		if( film ) {
  			let minusFifteen = new Date(film.release_date);
  			minusFifteen.setFullYear(minusFifteen.getFullYear() - 15);
  			let plusFifteen = new Date(film.release_date);
  			plusFifteen.setFullYear(plusFifteen.getFullYear() + 15);

  			FILMS.findAll({
  				where: {
  					genre_id: film.genre_id,
  					release_date: {
  						$between: [minusFifteen, plusFifteen]
  					}
  				},
  				include: [GENRES],
  				order: ['film.id']
  			})
  			.then( results => {
  				let matchedFilms = '';
  				for(let i=0; i<results.length; i++) {
  					if(i == results.length - 1) {
  						matchedFilms += results[i].id;
  					}else{
  						matchedFilms += results[i].id + ',';
  					}
  				}

  				request('http://credentials-api.generalassemb.ly/4576f55f-c427-4cfc-a11c-5bfe914ca6c1?films=' + matchedFilms, (err, response, body)=> {
  					let reviews = JSON.parse(response.body);
  					for(let j=0; j<results.length; j++) {
  						results[j].reviews = reviews[j].reviews;
  					}

  					results = results.filter(result => {
  						return result.reviews.length >= 5;
  					})

  					results = results.filter(result => {
  						return result.reviews > 4.0;
  					})

  					let filmResponse = [];
  					results.forEach(result => {
  						filmResponse.push({
  							id: result.id,
  							title: result.title,
  							releaseDate: result.release_date,
  							genre: result.genre.name,
                averageRating: (parseInt(result.reviews.length) / parseInt(result.reviews.rating)),
  							reviews: result.reviews.length
  						})
  					})

  					res.status(200).json({
  						recommendations: filmResponse.slice(offset, offset + limit),
  						meta: {limit: limit, offset: offset}
  					})
  				});
  			})
  			.catch( err => {
  				console.log(err);
  				res.status(422).json({message: 'key is missing'});
  			})
  		}
  	})
  	.catch( err => {
  		console.log(err);
  		res.status(422).json({message: 'key is missing'});
  	});
}

module.exports = app;