// USERS will be loaded from the database
let USERS = [];



const STATE = {
  currentUser: null,
  lastMessageAuthor: null,
};

$(document).ready(() => {
  const $elements = {
    list: $('.chat-list'),
    header: $('.current-chat'),
    historyContainer: $('.chat-history'),
    history: $('.chat-history ul'),
    input: $('textarea[name=message]'),
    btn: $('.btn-send'),
  };

  const socket = io({});
  window.socketsocket = socket;

  const templates = {
    contact: $('#template-contact').html(),
    message: {
      other: $('#template-other-message').html(),
      my: $('#template-my-message').html(),
    },
  };

  const setUserChat = (user, target) => {
    if (STATE.currentUser === user.id) {
      return;
    }

    $elements.list.find('.active').removeClass('active');
    target.addClass('active');
    $elements.header.text(user.name);
    STATE.currentUser = user.id;
    STATE.lastMessageAuthor = null;
    $elements.history.empty();
    $elements.input.focus();
  };

  const dispatchSendMessage = () => {
    const input = $elements.input.val();
    $elements.input.val('');
    if (input.length <= 0) {
      return;
    }
    handleInput(input);
  };

  const parseWhatsAppFormatting = (text) => {
    text = text.replace(/\*(.+?)\*/g, '<strong>$1</strong>');

    text = text.replace(/_(.+?)_/g, '<em>$1</em>');

    text = text.replace(/~(.+?)~/g, '<del>$1</del>');

    text = text.replace(/``````/g, '<pre><code>$1</code></pre>');

    return text;
  };


  const sanitizeMessage = (content) => {
    if (content.mimetype == 'image/webp') {
      return `<img src="data:${content.mimetype};base64,${content.data}" alt="sticker" />`;
    }

    let formatted = parseWhatsAppFormatting(content);

    return formatted.replaceAll('\n', '<br>');
  };

  const appendMessage = (template, content, joinLastMessage) => {
    const $message = $(template);
    if (joinLastMessage) {
      $message.addClass('join-message')
    }
    $message.find('.message').html(sanitizeMessage(content));
    $elements.history.append($message);
  };

  const appendMyMessage = (content) => {
    console.log(content);

    const joinLastMessage = STATE.lastMessageAuthor === 'my';
    STATE.lastMessageAuthor = 'my';
    appendMessage(templates.message.my, content, joinLastMessage);
  };

  const appendOtherMessage = (content) => {
    const joinLastMessage = STATE.lastMessageAuthor === 'other';
    STATE.lastMessageAuthor = 'other';
    appendMessage(templates.message.other, content, joinLastMessage);
  };

  const handleInput = (input) => {
    appendMyMessage(input);
    const user = USERS.find((u) => u.id === STATE.currentUser);

    fetch('/', {
      method: 'post',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ input, user }),
    })
      .then((res) => res.json())
      .then((json) => {
        console.log(json);
      })
      .catch((e) => {
        console.error(e);
        alert('Error. Check console');
      });
  };

  // Function to load users from API and initialize chat list
  const loadUsersAndInitialize = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/public/users');
      if (!response.ok) {
        throw new Error('Failed to fetch users');
      }
      USERS = await response.json();
      console.log(`Loaded ${USERS.length} users from database`);

      // Initialize chat list with loaded users
      USERS.map((user, index) => {
        const $contact = $(templates.contact);

        $contact.find('.name').text(user.name + ' (' + user.groupId + ')');

        if (index === 0) {
          setUserChat(user, $contact);
        }

        $contact.on('click', () => {
          setUserChat(user, $contact);
        });
        $elements.list.append($contact);
      });
    } catch (error) {
      console.error('Error loading users:', error);
      alert('Failed to load users from database. Check console for details.');
    }
  };

  // Load users when page is ready
  loadUsersAndInitialize();

  $elements.input.on('keydown', (e) => {
    if (e.which === 13 && !e.shiftKey) {
      dispatchSendMessage();
      e.preventDefault();
      return;
    }
  });

  $elements.btn.on('click', () => {
    dispatchSendMessage();
  });

  socket.on('connect', () => {
    console.log('We are on');
  });

  socket.on('message', ({ message }) => {
    appendOtherMessage(message);
    $elements.historyContainer.scrollTop($elements.historyContainer.prop('scrollHeight'));
  });

  const preencherLista = () => {
    const shuffled = [...USERS].sort(() => 0.5 - Math.random());

    const goleiros = shuffled.slice(0, 2);
    const jogadores = shuffled.slice(2, 17);

    const sendWithDelay = (user, input, delay) => {
      setTimeout(() => {
        setUserChat(user, $(`.chat-list .contact:contains("${user.name}")`));
        handleInput(input);
      }, delay);
    };

    let delay = 0;
    goleiros.forEach((user) => {
      sendWithDelay(user, "/goleiro", delay);
      delay += 1000;
    });

    jogadores.forEach((user) => {
      sendWithDelay(user, "/bora", delay);
      delay += 1000;
    });
  };

  // preencherLista();
});
