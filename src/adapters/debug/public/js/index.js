(function() {

    var socket = io();
    var chat = {
        messageToSend: '',
        messageResponses: [
            'Why did the web developer leave the restaurant? Because of the table layout.',
            'How do you comfort a JavaScript bug? You console it.',
            'An SQL query enters a bar, approaches two tables and asks: "May I join you?"',
            'What is the most used language in programming? Profanity.',
            'What is the object-oriented way to become wealthy? Inheritance.',
            'An SEO expert walks into a bar, bars, pub, tavern, public house, Irish pub, drinks, beer, alcohol'
        ],
        init: function() {
            this.cacheDOM();
            this.bindEvents();
            this.render();
        },
        cacheDOM: function() {
            this.$chatHistory = $('.chat-history');
            this.$button = $('button');
            this.$textarea = $('#message-to-send');
            this.$chatHistoryList = this.$chatHistory.find('ul');
        },
        bindEvents: function() {
            this.$button.on('click', this.addMessage.bind(this));
            this.$textarea.on('keyup', this.addMessageEnter.bind(this));
        },
        render: function() {
            this.scrollToBottom();
            if (this.messageToSend.trim() !== '') {

                socket.emit('message', {"text": this.$textarea.val()});

                var template = Handlebars.compile($("#message-template").html());
                var context = {
                    messageOutput: this.messageToSend,
                    time: this.getCurrentTime()
                };

                this.$chatHistoryList.append(template(context));
                this.scrollToBottom();
                this.$textarea.val('');

                // responses
                var templateResponse = Handlebars.compile($("#message-response-template").html());
                var contextResponse = {
                    response: this.getRandomItem(this.messageResponses),
                    time: this.getCurrentTime()
                };

                setTimeout(function() {
                    this.$chatHistoryList.append(templateResponse(contextResponse));
                    this.scrollToBottom();
                }.bind(this), 1500);

            }

        },

        addMessage: function() {
            this.messageToSend = this.$textarea.val();
            this.render();
        },
        addMessageEnter: function(event) {
            // enter was pressed
            if (event.keyCode === 13) {
                this.addMessage();
            }
        },
        scrollToBottom: function() {
            this.$chatHistory.scrollTop(this.$chatHistory[0].scrollHeight);
        },
        getCurrentTime: function() {
            return new Date().toLocaleTimeString().
            replace(/([\d]+:[\d]{2})(:[\d]{2})(.*)/, "$1$3");
        },
        getRandomItem: function(arr) {
            return arr[Math.floor(Math.random() * arr.length)];
        }

    };

    chat.init();

    var searchFilter = {
        options: {
            valueNames: ['name']
        },
        init: function() {
            var userList = new List('people-list', this.options);
            var noItems = $('<li id="no-items-found">No items found</li>');

            userList.on('updated', function(list) {
                if (list.matchingItems.length === 0) {
                    $(list.list).append(noItems);
                } else {
                    noItems.detach();
                }
            });
        }
    };

    searchFilter.init();

    $('#login').submit(function(e) {
        e.preventDefault();
        e.stopPropagation();
        var name = $('#name').val();
        var username = $('#username').val();
        var msg = {
            "name": name,
            "username": username
        };
        console.log(msg);
        socket.emit('identify', msg);
        return false;
    });

    socket.on('ready', function(msg) {
            $('.login').fadeOut();
            $('body').attr('id', msg.id);
        })
        .on('delete_message', function(msg) {
            console.log('delete_message', msg);
        })
        .on('bot_is_typing', function(msg) {
            console.log('bot_is_typing', msg);
        })
        .on('add_reaction_to', function(msg) {
            console.log('add_reaction_to', msg);
        })
        .on('bot_said', function(msg) {
            console.log('bot_said', msg);
        })
        .on('user_said', function(msg) {
            console.log('user_said', msg);
        });

})();
