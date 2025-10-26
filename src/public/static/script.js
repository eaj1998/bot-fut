const USERS = [
  { id: 1, name: 'Luquinhas', phone: '+5549988124389' },
  { id: 2, name: 'Edipão', phone: '+554992007299' },
  { id: 3, name: 'Mikelongelo', phone: '+554187770278' },
  { id: 4, name: 'Sabrina', phone: '+5547998542231' },
  { id: 5, name: 'Vitinho', phone: '+5547997334122' },
  { id: 6, name: 'Carlinhos', phone: '+5548998893012' },
  { id: 7, name: 'Joãozinho', phone: '+5547988776655' },
  { id: 8, name: 'Pedrão', phone: '+5547999123456' },
  { id: 9, name: 'Tainá', phone: '+5548998456723' },
  { id: 10, name: 'Aninha', phone: '+5547998012345' },
  { id: 11, name: 'Felipão', phone: '+5541999123456' },
  { id: 12, name: 'Gui', phone: '+5547999456123' },
  { id: 13, name: 'Léo', phone: '+5548999654321' },
  { id: 14, name: 'Biel', phone: '+5541999988776' },
  { id: 15, name: 'Thay', phone: '+5547999332211' },
  { id: 16, name: 'Rafa', phone: '+5541998877665' },
  { id: 17, name: 'Val', phone: '+5541998877265' },
  { id: 18, name: 'Andrei', phone: '+5541992877665' },
];

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

  const sanitizeMessage = (content) => {
    return content.replaceAll('\n', '<br>');
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

  USERS.map((user, index) => {
    const $contact = $(templates.contact);

    $contact.find('.name').text(user.name);

    if (index === 0) {
      setUserChat(user, $contact);
    }

    $contact.on('click', () => {
      setUserChat(user, $contact);
    });
    $elements.list.append($contact);
  });

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
});
