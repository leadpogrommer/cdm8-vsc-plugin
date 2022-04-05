window.addEventListener('message', (event) => {
  const message = event.data; // The JSON data our extension sent

  const div = document.getElementById('table-div') as HTMLDivElement;
  div.innerHTML = '';
  const table = document.createElement('table');

  let memory = message.body.memory as number[];

  for(let y = 0; y < 16; y++){
      let row = document.createElement('tr');
      for(let x = 0; x < 16; x++){
          let td = document.createElement('td');
          td.innerText = memory[y*16+x].toString();
          row.appendChild(td);
      }
      table.appendChild(row);
  }

  div.appendChild(table);
});
