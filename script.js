document.addEventListener('alpine:init', () => {
    Alpine.data('rssReader', () => ({
        feeds: {
            MajorNews: {
                psychology: { 
                    url: 'https://corsproxy.io/?url=https://www.psychologytoday.com/us/front/feed',
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
                    url: 'https://api.allorigins.win/raw?url=http://rss.cnn.com/rss/cnn_topstories.rss',
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

        async init() {
            this.loadAllFeeds();
            this.setupScrollListener();
            this.setupScrollAnimations();
        },

        setupScrollListener() {
            const retroGraphics = document.getElementById('retroGraphics');
            window.addEventListener('scroll', () => {
                if (window.scrollY > 100) {
                    retroGraphics.classList.add('scrolling-out');
                } else {
                    retroGraphics.classList.remove('scrolling-out');
                }
            });
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
                threshold: 0.1,
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
        }
    }));
});
