document.addEventListener('alpine:init', () => {
    Alpine.data('rssReader', () => ({
        feeds: {
            MajorNews: {
                psychology: { 
                    url: 'https://rss.app/feeds/XPibKdvcWhqOBAWZ.xml',
                    id: 'psychology-feed',
                    title: 'Psychology Today'
                },
                reuters: {
                    url: 'https://api.allorigins.win/raw?url=https://news.google.com/rss/search?q=site%3Areuters.com&hl=en-US&gl=US&ceid=US%3Aen',
                    id: 'reuters-feed',
                    title: 'Reuters News'
                },
                nyt: {
                    url: 'https://corsproxy.io/?url=https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml',
                    id: 'nyt-feed',
                    title: 'New York Times'
                },
                wsj: {
                    url: 'https://corsproxy.io/?url=https://feeds.a.dj.com/rss/RSSWorldNews.xml',
                    id: 'wsj-feed',
                    title: 'Wall Street Journal'
                },
                cnn: {
                    url: 'https://api.allorigins.win/raw?url=https://news.google.com/rss/search?q=site%3Acnn.com&hl=en-US&gl=US&ceid=US%3Aen',
                    id: 'cnn-feed',
                    title: 'CNN Top Stories'
                },
                ap: {
                    url: 'https://api.allorigins.win/raw?url=https://news.google.com/rss/search?q=site%3Aapnews.com&hl=en-US&gl=US&ceid=US%3Aen',
                    id: 'ap-feed',
                    title: 'AP News'
                },
                npr: { 
                    url: 'https://corsproxy.io/?url=https://feeds.npr.org/1001/rss.xml',
                    id: 'npr-feed',
                    title: 'NPR News'
                }
            },
            Books: {
                goodreads: {
                    url: 'https://api.allorigins.win/raw?url=https://news.google.com/rss/search?q=site%3Agoodreads.com&hl=en-US&gl=US&ceid=US%3Aen',
                    id: 'goodreads-feed',
                    title: 'Goodreads Updates'
                },
                nytBooks: {
                    url: 'https://corsproxy.io/?url=https://rss.nytimes.com/services/xml/rss/nyt/Books.xml',
                    id: 'nyt-books-feed',
                    title: 'NYT Books'
                }
            },
            GameDeals: {
                epic: {
                    url: 'https://corsproxy.io/?url=https://feed.phenx.de/lootscraper_epic_game.xml',
                    id: 'epic-deals-feed',
                    title: 'Epic Games Deals'
                },
                amazon: {
                    url: 'https://corsproxy.io/?url=https://feed.phenx.de/lootscraper_amazon_game.xml',
                    id: 'amazon-deals-feed',
                    title: 'Amazon Game Deals'
                }
            }
        },
        feedData: {},
        loading: {},
        weather: {
            current: {
                temperature: null,
                location: 'Philadelphia, PA',
                description: 'Loading...',
                precipitation: null,
                windSpeed: null,
                windDirection: null
            },
            daily: {
                high: null,
                low: null,
                sunrise: null,
                sunset: null,
                precipitationChance: null,
                windSpeed: null,
                windGusts: null
            }
        },

        async init() {
            await this.loadAllFeeds();
            await this.setupScrollAnimations();
            await this.loadWeather();
        },

        setupScrollAnimations() {
            const observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        // Get all articles in the same feed section
                        const feedSection = entry.target.closest('.feed-section');
                        const articles = feedSection?.querySelectorAll('.article') || [];
                        
                        // Animate articles in order
                        Array.from(articles).forEach((article, index) => {
                            setTimeout(() => {
                                article.classList.add('animate');
                            }, index * 50); // Reduced delay between items
                        });

                        // Unobserve the entire feed section
                        if (feedSection) {
                            observer.unobserve(feedSection);
                        }
                    }
                });
            }, {
                threshold: 0.3,
                rootMargin: '0px 0px -20px 0px' // Trigger animation slightly earlier
            });

            // Observe feed sections instead of individual articles
            this.$watch('feedData', () => {
                setTimeout(() => {
                    document.querySelectorAll('.feed-section').forEach(section => {
                        observer.observe(section);
                    });
                }, 100);
            });
        },

        async parseRSS(url) {
            try {
                const response = await fetch(url);
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                
                const text = await response.text();
                const parser = new DOMParser();
                const xmlDoc = parser.parseFromString(text, 'text/xml');
                
                if (xmlDoc.querySelector('parsererror')) throw new Error('XML parsing error');

                // Check if this is an Atom feed (game deals)
                const isAtom = xmlDoc.querySelector('feed');
                const items = Array.from(isAtom ? 
                    xmlDoc.querySelectorAll('entry') : 
                    xmlDoc.querySelectorAll('item'));
                
                if (items.length === 0) throw new Error('No items found in feed');

                return items.map(item => ({
                    title: this.getNodeText(item, 'title'),
                    link: this.getNodeLink(item),
                    description: isAtom ? 
                        this.getAtomContent(item) : 
                        this.getNodeText(item, 'description, summary, content'),
                    pubDate: new Date(this.getNodeText(item, 'updated, published, pubDate')),
                    imageUrl: this.getImageUrl(item, isAtom)
                }));
            } catch (error) {
                console.error('Error parsing RSS:', error);
                return [];
            }
        },

        getNodeText(item, selectors) {
            const node = item.querySelector(selectors);
            return node ? node.textContent.trim() : '';
        },

        getNodeLink(item) {
            const link = item.querySelector('link');
            return link?.textContent || link?.getAttribute('href') || '';
        },

        getImageUrl(item, isAtom) {
            if (isAtom) {
                // For Atom feeds (game deals), check content div first
                const content = item.querySelector('content div');
                if (content) {
                    const img = content.querySelector('img');
                    if (img) return img.getAttribute('src');
                }
            }
            
            // Fallback to other methods
            return this.getMediaContent(item) || 
                   this.getEnclosureImage(item) ||
                   this.getDescriptionImage(item) ||
                   this.getThumbnail(item);
        },

        getMediaContent(item) {
            const mediaContent = item.querySelector('media\\:content, content');
            return mediaContent?.getAttribute('url') || '';
        },

        getEnclosureImage(item) {
            const enclosure = item.querySelector('enclosure');
            const type = enclosure?.getAttribute('type') || '';
            if (type.startsWith('image/')) {
                return enclosure.getAttribute('url') || '';
            }
            return '';
        },

        getDescriptionImage(item) {
            const description = this.getNodeText(item, 'description, summary, content');
            const div = document.createElement('div');
            div.innerHTML = description;
            
            // Try to find image in description
            const img = div.querySelector('img');
            if (img?.src) {
                return img.src;
            }

            // Look for image URLs in the text
            const urlMatch = description.match(/https?:\/\/[^\s<>"']+?\.(?:jpg|jpeg|gif|png|webp)/i);
            return urlMatch ? urlMatch[0] : '';
        },

        getThumbnail(item) {
            const thumbnail = item.querySelector('thumbnail');
            return thumbnail?.getAttribute('url') || '';
        },

        getAtomContent(item) {
            const content = item.querySelector('content');
            if (!content) return '';

            // Handle XHTML content
            const div = content.querySelector('div');
            if (div) {
                // Extract game details
                const details = Array.from(div.querySelectorAll('ul li'))
                    .map(li => li.textContent)
                    .join('\n');
                return details;
            }
            return content.textContent;
        },

        formatSectionTitle(key) {
            return key.split(/(?=[A-Z])/).join(' ');
        },

        truncateDescription(text) {
            const div = document.createElement('div');
            div.innerHTML = text;
            
            // For game deals, format the important information
            const details = div.textContent.split('\n')
                .filter(line => line.trim())
                .slice(0, 3) // Show first 3 lines of details
                .join('\n');
            
            return details;
        },

        async fetchFeed(feed, maxItems = 5) {
            this.loading[feed.id] = true;
            this.feedData[feed.id] = []; // Clear existing data
            
            try {
                const items = await this.parseRSS(feed.url);
                if (items.length > 0) {
                    this.feedData[feed.id] = items.slice(0, maxItems);
                } else {
                    console.warn(`No items found for feed: ${feed.id}`);
                }
            } catch (error) {
                console.error(`Error fetching feed ${feed.id}:`, error);
            } finally {
                this.loading[feed.id] = false;
            }
        },

        async loadAllFeeds() {
            for (const section of Object.values(this.feeds)) {
                for (const feed of Object.values(section)) {
                    await this.fetchFeed(feed);
                }
            }
        },

        async loadWeather() {
            const params = {
                "latitude": 40.1023,
                "longitude": -75.1521,
                "hourly": ["temperature_2m", "precipitation_probability", "precipitation", "wind_speed_10m", "wind_direction_10m"],
                "daily": ["temperature_2m_max", "temperature_2m_min", "sunrise", "sunset", "precipitation_sum", "precipitation_hours", "precipitation_probability_max", "wind_speed_10m_max", "wind_gusts_10m_max"],
                "temperature_unit": "fahrenheit",
                "wind_speed_unit": "mph",
                "precipitation_unit": "inch",
                "timezone": "America/New_York"
            };
            
            try {
                const response = await fetch(`https://api.open-meteo.com/v1/forecast?${new URLSearchParams(params)}`);
                const data = await response.json();
                
                // Current conditions (using current hour)
                const currentHour = new Date().getHours();
                this.weather.current = {
                    temperature: Math.round(data.hourly.temperature_2m[currentHour]),
                    location: 'Philadelphia, PA',
                    description: this.getWeatherDescription(data.hourly.temperature_2m[currentHour]),
                    precipitation: data.hourly.precipitation_probability[currentHour],
                    windSpeed: Math.round(data.hourly.wind_speed_10m[currentHour]),
                    windDirection: this.getWindDirection(data.hourly.wind_direction_10m[currentHour])
                };

                // Daily forecast (using first day)
                this.weather.daily = {
                    high: Math.round(data.daily.temperature_2m_max[0]),
                    low: Math.round(data.daily.temperature_2m_min[0]),
                    sunrise: new Date(data.daily.sunrise[0]).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
                    sunset: new Date(data.daily.sunset[0]).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
                    precipitationChance: data.daily.precipitation_probability_max[0],
                    windSpeed: Math.round(data.daily.wind_speed_10m_max[0]),
                    windGusts: Math.round(data.daily.wind_gusts_10m_max[0])
                };
            } catch (error) {
                console.error('Error fetching weather:', error);
                this.weather.current.description = 'Weather unavailable';
            }
        },

        getWindDirection(degrees) {
            const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
            const index = Math.round(degrees / 45) % 8;
            return directions[index];
        },

        getWeatherDescription(temp) {
            if (temp <= 32) return 'Freezing';
            if (temp <= 50) return 'Cold';
            if (temp <= 65) return 'Cool';
            if (temp <= 75) return 'Pleasant';
            if (temp <= 85) return 'Warm';
            return 'Hot';
        },
    }));
});
