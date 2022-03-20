package com.ihfazh.ksatriamuslim.ui

import androidx.compose.foundation.Image
import androidx.compose.foundation.border
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
import com.ihfazh.ksatriamuslim.R


@OptIn(ExperimentalMaterialApi::class)
@Composable
fun MenuItem(title: String, image: Int, onClick: () -> Unit){
    Card(
        onClick = onClick,
        onClickLabel = title
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
            modifier = Modifier
                .padding(5.dp),
        ) {
            Image(
                painter = painterResource(id = image),
                contentDescription = title,
                modifier = Modifier
                    .size(50.dp)
                    .clip(CircleShape)
                    .border(2.dp, Color.Gray, CircleShape)
                    .padding(5.dp)

            )
            Text(
                text = title,
                style = MaterialTheme.typography.subtitle2,
            )
        }
    }

}


@Preview
@Composable
fun PreviewMenuItem(){
    MenuItem(
        title = "Anak anak",
        image = R.drawable.ic_baseline_person_24,
        onClick = {}
    )
}