const groupId = '1111111111111111111@g.us';
const groupId2 = '999999999999999999@g.us';
const PARTICIPANTS = [{ id: 1, name: 'Luquinhas', phone: '+5549988124389', groupId: groupId },
{ id: 2, name: 'Edipão', phone: '+554992007299', groupId: groupId },
{ id: 3, name: 'Mikelongelo', phone: '+554187770278', groupId: groupId },
{ id: 4, name: 'Sabrina', phone: '+5547998542231', groupId: groupId },
{ id: 5, name: 'Vitinho', phone: '+5547997334122', groupId: groupId },
{ id: 6, name: 'Carlinhos', phone: '+5548998893012', groupId: groupId },
{ id: 7, name: 'Joãozinho', phone: '+5547988776655', groupId: groupId },
{ id: 8, name: 'Pedrão', phone: '+5547999123456', groupId: groupId },
{ id: 9, name: 'Tainá', phone: '+5548998456723', groupId: groupId },
{ id: 10, name: 'Aninha', phone: '+5547998012345', groupId: groupId },
{ id: 11, name: 'Felipão', phone: '+5541999123456', groupId: groupId },
{ id: 12, name: 'Gui', phone: '+5547999456123', groupId: groupId },
{ id: 13, name: 'Léo', phone: '+5548999654321', groupId: groupId },
{ id: 14, name: 'Biel', phone: '+5541999988776', groupId: groupId },
{ id: 15, name: 'Thay', phone: '+5547999332211', groupId: groupId },
{ id: 16, name: 'Rafa', phone: '+5541998877665', groupId: groupId },
{ id: 17, name: 'Val', phone: '+5541998877265', groupId: groupId },
{ id: 18, name: 'Andrei', phone: '+5541992877665', groupId: groupId },]

const USERS = [
  { id: 1, name: 'Luquinhas', phone: '+5549988124389@c.us', groupId: groupId, participants: PARTICIPANTS },
  { id: 2, name: 'Edipão', phone: '+554992007299@c.us', groupId: groupId, participants: PARTICIPANTS },
  { id: 3, name: 'Mikelongelo', phone: '+554187770278@c.us', groupId: groupId, participants: PARTICIPANTS },
  { id: 4, name: 'Sabrina', phone: '+5547998542231@c.us', groupId: groupId, participants: PARTICIPANTS },
  { id: 5, name: 'Vitinho', phone: '+5547997334122@c.us', groupId: groupId, participants: PARTICIPANTS },
  { id: 6, name: 'Carlinhos', phone: '+5548998893012@c.us', groupId: groupId, participants: PARTICIPANTS },
  { id: 7, name: 'Joãozinho', phone: '+5547988776655@c.us', groupId: groupId, participants: PARTICIPANTS },
  { id: 8, name: 'Pedrão', phone: '+5547999123456@c.us', groupId: groupId, participants: PARTICIPANTS },
  { id: 9, name: 'Tainá', phone: '+5548998456723@c.us', groupId: groupId, participants: PARTICIPANTS },
  { id: 10, name: 'Aninha', phone: '+5547998012345@c.us', groupId: groupId, participants: PARTICIPANTS },
  { id: 11, name: 'Felipão', phone: '+5541999123456@c.us', groupId: groupId, participants: PARTICIPANTS },
  { id: 12, name: 'Gui', phone: '+5547999456123@c.us', groupId: groupId, participants: PARTICIPANTS },
  { id: 13, name: 'Léo', phone: '+5548999654321@c.us', groupId: groupId, participants: PARTICIPANTS },
  { id: 14, name: 'Biel', phone: '+5541999988776@c.us', groupId: groupId, participants: PARTICIPANTS },
  { id: 15, name: 'Thay', phone: '+5547999332211@c.us', groupId: groupId, participants: PARTICIPANTS },
  { id: 16, name: 'Rafa', phone: '+5541998877665@c.us', groupId: groupId, participants: PARTICIPANTS },
  { id: 17, name: 'Val', phone: '+5541998877265@c.us', groupId: groupId, participants: PARTICIPANTS },
  { id: 18, name: 'Andrei', phone: '+5541992877665@c.us', groupId: groupId, participants: PARTICIPANTS },
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

  preencherLista();
});
