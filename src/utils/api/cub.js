import Reguest from '../reguest'
import Utils from '../math'
import Storage from '../storage'
import Status from '../status'
import Favorite from '../../utils/favorite'
import Recomends from '../../utils/recomend'
import Arrays from '../../utils/arrays'
import Lang from '../lang'
import TMDB from './tmdb'
import TMDBApi from '../tmdb'
import Activity from '../../interaction/activity'
import Api from '../../interaction/api'
import TimeTable from '../../utils/timetable'
import Episode from '../../interaction/episode'
import Manifest from '../manifest'

let baseurl   = Utils.protocol() + 'tmdb.'+Manifest.cub_domain+'/'
let network   = new Reguest()


function url(u, params = {}){
    if(params.genres)  u = add(u, 'genre='+params.genres)
    if(params.page)    u = add(u, 'page='+params.page)
    if(params.query)   u = add(u, 'query='+params.query)

    if(params.filter){
        for(let i in params.filter){
            u = add(u, i+'='+params.filter[i])
        }
    }

    return baseurl + u
}

function add(u, params){
    return u + (/\?/.test(u) ? '&' : '?') + params;
}

function get(method, params = {}, oncomplite, onerror){
    let u = url(method, params)
    
    network.silent(u,(json)=>{
        json.url = method

        oncomplite(json)
    }, onerror)
}

function list(params = {}, oncomplite, onerror){
    let u = url(params.url, params)

    network.silent(u,oncomplite, onerror)
}

function main(params = {}, oncomplite, onerror){
    let parts_limit = 6
    let parts_data  = [
        (call)=>{
            get('?sort=now_playing',params,(json)=>{
                json.title = Lang.translate('title_now_watch')

                call(json)
            },call)
        },
        (call)=>{
            get('?sort=latest',params,(json)=>{
                json.title = Lang.translate('title_latest')

                call(json)
            },call)
        },
        (call)=>{
            get('?cat='+params.url+'&sort=latest&uhd=true',params,(json)=>{
                json.title = Lang.translate('title_in_high_quality')
                json.small = true
                json.wide = true

                json.results.forEach(card=>{
                    card.promo = card.overview
                    card.promo_title = card.title || card.name
                })

                call(json)
            },call)
        },
        (call)=>{
            get('movie/now',params,(json)=>{
                json.title = Lang.translate('menu_movies')

                call(json)
            },call)
        },
        (call)=>{
            trailers('added',call,call)
        },
        (call)=>{
            get('tv/now',params,(json)=>{
                json.title = Lang.translate('menu_tv')

                call(json)
            },call)
        },
        (call)=>{
            get('tv/popular',params,(json)=>{
                json.title = Lang.translate('title_popular_tv')

                call(json)
            },call)
        },
    ]

    Arrays.insert(parts_data,0,Api.partPersons(parts_data, parts_limit, 'movie'))

    TMDB.genres.movie.forEach(genre=>{
        let event = (call)=>{
            get('?sort=now&genre='+genre.id,params,(json)=>{
                json.title = Lang.translate(genre.title.replace(/[^a-z_]/g,''))

                call(json)
            },call)
        }

        parts_data.push(event)
    })

    network.silent(Utils.protocol() + Manifest.cub_domain + '/api/collections/roll',(data)=>{
        let rolls   = data.results.filter(a=>a.type)
        let total   = parts_data.length - (parts_limit + 3)
        let offset  = Math.round(total / rolls.length)

        rolls.forEach((collection,index)=>{
            Arrays.insert(parts_data, index + parts_limit + 3 + (offset * index), (call_inner)=>{
                get('collections/'+collection.hpu,{},(json)=>{
                    json.title = collection.title
                    json.collection = true
                    json.line_type  = 'collection'
    
                    call_inner(json)
                },call_inner)
            })
        })
    })

    function loadPart(partLoaded, partEmpty){
        Api.partNext(parts_data, parts_limit, partLoaded, partEmpty)
    }

    loadPart(oncomplite, onerror)

    return loadPart
}

function category(params = {}, oncomplite, onerror){
    let show     = ['movie','tv'].indexOf(params.url) > -1 && !params.genres
    let books    = show ? Favorite.continues(params.url) : []
    let recomend = show ? Arrays.shuffle(Recomends.get(params.url)).slice(0,19) : []
    let airdate  = params.url == 'anime' ? '&airdate=' + (new Date()).getFullYear() : ''
    
    let parts_limit = 6
    let parts_data  = [
        (call)=>{
            let json = {results: books, title: params.url == 'tv' ? Lang.translate('title_continue') : Lang.translate('title_watched')}

            if(params.url == 'tv'){
                json.ad    = 'notice',
                json.type  = params.url
            }

            call(json)
        },
        (call)=>{
            if(params.url == 'tv' || params.url == 'anime'){
                call({
                    results: TimeTable.lately().slice(0,20),
                    title: Lang.translate('title_upcoming_episodes'),
                    nomore: true,
                    cardClass: (_elem, _params)=>{
                        return new Episode(_elem, _params)
                    }
                })
            }
            else{
                call()
            }
        },
        (call)=>{
            call({results: recomend,title: Lang.translate('title_recomend_watch')})
        },
        (call)=>{
            get('?cat='+params.url+'&sort=now_playing'+airdate,params,(json)=>{
                json.title = Lang.translate('title_now_watch')

                call(json)
            },call)
        },
        (call)=>{
            if(params.url == 'anime'){
                get('?cat='+params.url+'&sort=top',params,(json)=>{
                    json.title = Lang.translate('title_in_top')
                    json.small = true
                    json.wide  = true

                    json.results.forEach(card=>{
                        card.promo = card.overview
                        card.promo_title = card.title || card.name
                    })
    
                    call(json)
                },call)
            }
            else{
                get('?cat='+params.url+'&sort=latest&uhd=true'+airdate,params,(json)=>{
                    json.title = Lang.translate('title_in_high_quality')
                    json.small = true
                    json.wide = true

                    json.results.forEach(card=>{
                        card.promo = card.overview
                        card.promo_title = card.title || card.name
                    })

                    call(json)
                },call)
            }
        },
        (call)=>{
            if(params.url == 'tv' || params.url == 'anime'){
                get('?cat='+params.url+'&sort=airing'+airdate,params,(json)=>{
                    json.title = Lang.translate('title_ongoing')

                    call(json)
                },call)
            }
            else call()
        },
        (call)=>{
            get('?cat='+params.url+'&sort=top'+airdate,params,(json)=>{
                json.title = Lang.translate('title_popular')

                call(json)
            },call)
        },
        (call)=>{
            get('?cat='+params.url+'&sort=now',params,(json)=>{
                json.title = Lang.translate('title_new_this_year')

                call(json)
            },call)
        },
        (call)=>{
            if(params.url == 'movie') trailers('added',call,call)
            else if(params.url == 'anime'){
                get('?cat='+params.url+'&sort=top&&airdate=' + (new Date().getFullYear() - 1),params,(json)=>{
                    json.title = Lang.translate('title_last_year')
    
                    call(json)
                },call)
            }
            else call()
        },
        (call)=>{
            get('?cat='+params.url+'&sort=latest&vote=7',params,(json)=>{
                json.title = Lang.translate('title_hight_voite')

                call(json)
            },call)
        }
    ]

    if(!params.genres){
        Arrays.insert(parts_data,0,Api.partPersons(parts_data, parts_limit + 3, params.url))

        if(TMDB.genres[params.url]){
            TMDB.genres[params.url].forEach(genre=>{
                let event = (call)=>{
                    get('?cat='+params.url+'&sort=now&genre='+genre.id,params,(json)=>{
                        json.title = Lang.translate(genre.title.replace(/[^a-z_]/g,''))

                        call(json)
                    },call)
                }

                parts_data.push(event)
            })

            network.silent(Utils.protocol() + Manifest.cub_domain + '/api/collections/roll',(data)=>{
                let rolls   = data.results.filter(a=>a.type == params.url)
                let total   = parts_data.length - (parts_limit + 3)
                let offset  = Math.round(total / rolls.length)

                rolls.forEach((collection,index)=>{
                    Arrays.insert(parts_data, index + parts_limit + 3 + (offset * index), (call_inner)=>{
                        get('collections/'+collection.hpu,{},(json)=>{
                            json.title = collection.title
                            json.collection = true
                            json.line_type  = 'collection'
            
                            call_inner(json)
                        },call_inner)
                    })
                })
            })
        }
        else if(params.url == 'anime'){
            TMDB.genres.tv.filter(a=>!(a.id == 99 || a.id == 10766)).forEach(genre=>{
                let event = (call)=>{
                    get('?cat='+params.url+'&sort=top&genre='+genre.id,params,(json)=>{
                        json.title = Lang.translate(genre.title.replace(/[^a-z_]/g,''))

                        call(json)
                    },call)
                }

                parts_data.push(event)
            })
        }
    } 

    function loadPart(partLoaded, partEmpty){
        Api.partNext(parts_data, parts_limit, partLoaded, partEmpty)
    }

    loadPart(oncomplite, onerror)

    return loadPart
}

function full(params, oncomplite, onerror){
    let status = new Status(8)
        status.onComplite = oncomplite

    if(Utils.dcma(params.method, params.id)) return onerror()

    get('3/'+params.method+'/'+params.id+'?api_key='+TMDBApi.key()+'&append_to_response=content_ratings,release_dates,keywords&language='+Storage.field('tmdb_lang'),params,(json)=>{
        json.source = 'tmdb'

        if(params.method == 'tv'){
            let season = Utils.countSeasons(json)

            TMDB.get('tv/'+json.id+'/season/'+season,{},(ep)=>{
                status.append('episodes', ep)
            },status.error.bind(status))
        }
        else status.need--

        if(json.belongs_to_collection){
            TMDB.get('collection/'+json.belongs_to_collection.id,{},(collection)=>{
                collection.results = collection.parts.slice(0,19)

                status.append('collection', collection)
            },status.error.bind(status))
        }
        else status.need--

        status.append('movie', json)
    },()=>{
        status.need -= 2

        status.error()
    })

    TMDB.get(params.method+'/'+params.id+'/credits',params,(json)=>{
        status.append('persons', json)
    },status.error.bind(status))

    TMDB.get(params.method+'/'+params.id+'/recommendations',params,(json)=>{
        status.append('recomend', json)
    },status.error.bind(status))

    TMDB.get(params.method+'/'+params.id+'/similar',params,(json)=>{
        status.append('simular', json)
    },status.error.bind(status))
    
    let video_params = Arrays.clone(params)
        video_params.langs = ['en']

    TMDB.get(params.method+'/'+params.id+'/videos',video_params,(json)=>{
        status.append('videos', json)
    },status.error.bind(status))

    reactionsGet(params, (json)=>{
        status.append('reactions', json)
    })
}

function trailers(type, oncomplite){
    network.silent(Utils.protocol() + Manifest.cub_domain + '/api/trailers/short/trailers/' + type, (result)=>{
        result.wide  = true
        result.small = true

        result.results.forEach(card=>{
            card.promo = card.overview
            card.promo_title = card.title || card.name
        })

        result.title = Lang.translate('title_trailers') + ' - ' + Lang.translate('title_new')

        oncomplite(result)
    },()=>{
        oncomplite({results: []})
    })
}

function reactionsGet(params, oncomplite){
    network.silent(Utils.protocol() + Manifest.cub_domain + '/api/reactions/get/' + params.method + '_' + params.id, oncomplite,()=>{
        oncomplite({result: []})
    })
}

function reactionsAdd(params, oncomplite, onerror){
    network.silent(Utils.protocol() + Manifest.cub_domain + '/api/reactions/add/' + params.method + '_' + params.id + '/' + params.type, oncomplite, onerror)
}

function menuCategory(params, oncomplite){
    let menu = []

    menu.push({
        title: Lang.translate('title_now_watch'),
        url: '?cat='+params.action+'&sort=now_playing'
    })

    if(params.action == 'tv'){
        menu.push({
            title: Lang.translate('title_new_episodes'),
            url: '?cat='+params.action+'&sort=update'
        })
    }

    menu.push({
        title: Lang.translate('title_popular'),
        url: '?cat='+params.action+'&sort=top'
    })

    menu.push({
        title: Lang.translate('title_latest'),
        url: '?cat='+params.action+'&sort=latest'
    })

    menu.push({
        title: Lang.translate('title_new_this_year'),
        url: '?cat='+params.action+'&sort=now'
    })

    menu.push({
        title: Lang.translate('title_hight_voite'),
        url: '?cat='+params.action+'&sort=latest&vote=7'
    })

    oncomplite(menu)
}

function search(params = {}, oncomplite){
    let status = new Status(3)
        status.onComplite = (data)=>{
            let items = []

            if(data.movie && data.movie.results.length) items.push(data.movie)
            if(data.tv && data.tv.results.length)       items.push(data.tv)
            if(data.anime && data.anime.results.length) items.push(data.anime)

            oncomplite(items)
        }

    get('search/movie',params,(json)=>{
        json.title = Lang.translate('menu_movies')
        json.type = 'movie'

        status.append('movie', json)
    },status.error.bind(status))

    get('search/tv',params,(json)=>{
        json.title = Lang.translate('menu_tv')
        json.type = 'tv'

        status.append('tv', json)
    },status.error.bind(status))

    get('search/anime',params,(json)=>{
        json.title = Lang.translate('menu_anime')
        json.type = 'anime'

        status.append('anime', json)
    },status.error.bind(status))
}

function discovery(){
    return {
        title: 'CUB',
        search: search,
        params: {
            align_left: true,
            object: {
                source: 'cub'
            }
        },
        onMore: (params)=>{
            Activity.push({
                url: 'search/' + params.data.type,
                title: Lang.translate('search') + ' - ' + params.query,
                component: 'category_full',
                page: 2,
                query: encodeURIComponent(params.query),
                source: 'cub'
            })
        },
        onCancel: network.clear.bind(network)
    }
}

function person(params, oncomplite, onerror){
    TMDB.person(params, oncomplite, onerror)
}

function menu(params, oncomplite){
    TMDB.menu(params, oncomplite)
}

function seasons(tv, from, oncomplite){
    TMDB.seasons(tv, from, oncomplite)
}

function clear(){
    network.clear()
}

export default {
    main,
    menu,
    full,
    list,
    category,
    clear,
    person,
    seasons,
    menuCategory,
    discovery,
    reactionsGet,
    reactionsAdd
}
