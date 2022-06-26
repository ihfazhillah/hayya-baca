package com.ihfazh.ksatriamuslim.ui

import androidx.compose.foundation.Image
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.Card
import androidx.compose.material.ExperimentalMaterialApi
import androidx.compose.material.MaterialTheme
import androidx.compose.material.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import com.ihfazh.ksatriamuslim.R


@OptIn(ExperimentalMaterialApi::class)
@Composable
fun MenuItem(title: String, image: String?, onClick: () -> Unit) {
    Card(
        onClick = onClick,
        onClickLabel = title,
        backgroundColor = Color(233, 30, 99, 255)
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
            modifier = Modifier
                .padding(5.dp),
        ) {
            AsyncImage(
                model = image ?: R.drawable.ic_baseline_person_24,
                contentDescription = null,
                modifier = Modifier
                    .size(100.dp)
                    .clip(CircleShape)
                    .border(2.dp, Color.White, CircleShape)
                    .padding(5.dp)
            )
            Text(
                text = title,
                style = MaterialTheme.typography.subtitle2,
                color = Color.White
            )
        }
    }

}


@Preview
@Composable
fun PreviewMenuItem(){
    MenuItem(
        title = "Anak anak",
        image = null,
        onClick = {}
    )
}


@Composable
fun ChildItemParent(name: String?, onClick: () -> Unit){
    val resourceId = if (name == null){
        R.drawable.ic_baseline_add_circle_24
    } else {
        R.drawable.ic_baseline_person_24
    }

    Row(
        modifier = Modifier
            .clickable(onClick = onClick)
            .fillMaxWidth()
            .padding(5.dp),
        verticalAlignment = Alignment.CenterVertically,
    ){
        Image(painter = painterResource(id = resourceId), contentDescription = name)
        Spacer(modifier = Modifier.size(2.5.dp))
        Text(
            text=name ?: "Tambah baru",
            style = MaterialTheme.typography.h5
        )
    }
}


@Preview
@Composable
fun ChildItemParentPreview(){
    Column{
        ChildItemParent(name = "Lulu"){}
        ChildItemParent(null){}
    }
}